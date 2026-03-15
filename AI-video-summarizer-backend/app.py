import os
import whisper
import torch
from yt_dlp import YoutubeDL
from transformers import BartTokenizer, BartForConditionalGeneration
from pymongo import MongoClient
from datetime import datetime
import logging
from googletrans import Translator
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from dotenv import load_dotenv
import re
from werkzeug.utils import secure_filename
import uuid
from pathlib import Path
import hashlib
from typing import Optional
from gtts import gTTS

# APP SETUP 
app = Flask(__name__)
CORS(app)
load_dotenv()

# Create necessary directories
os.makedirs("downloads", exist_ok=True)
os.makedirs("uploads", exist_ok=True)
os.makedirs("static/audio", exist_ok=True)

# File upload configuration
ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv', 'webm', 'flv', 'wmv', 'm4v', 'mpg', 'mpeg', '3gp'}
MAX_CONTENT_LENGTH = 500 * 1024 * 1024
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

# LOAD MODELS 
print("Loading Whisper model (CPU-safe)...")
whisper_model = whisper.load_model("small") 

print("Loading BART summarizer...")
bart_tokenizer = BartTokenizer.from_pretrained("facebook/bart-large-cnn")
bart_model = BartForConditionalGeneration.from_pretrained("facebook/bart-large-cnn")

device = torch.device("cpu")
bart_model.to(device)

# DATABASE 
mongo_client = MongoClient(os.getenv("MONGO_URI"))
db = mongo_client["video_database"]
collection = db["transcripts"]

def calculate_video_hash(file_path: str) -> Optional[str]:
    """Calculate MD5 hash of video file for content recognition"""
    try:
        hash_md5 = hashlib.md5()
        with open(file_path, "rb") as f:
            # Read file in chunks to handle large files
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    except Exception as e:
        logging.error(f"Error calculating video hash: {e}")
        return None

# UTILS
def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def download_video_and_transcribe(url):
    """Download YouTube video and transcribe"""
    try:
        ydl_opts = {
            "format": "bestvideo+bestaudio/best",
            "outtmpl": "downloads/%(id)s.%(ext)s",
            "noplaylist": True,
            "quiet": True
        }

        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            video_file = ydl.prepare_filename(info)

        # Transcribe with timestamps
        result = whisper_model.transcribe(
            video_file,
            task="translate",
            temperature=0,
            condition_on_previous_text=False,
            word_timestamps=True
        )

        # Clean up downloaded file
        if os.path.exists(video_file):
            os.remove(video_file)

        return {
            "text": result["text"],
            "segments": result["segments"],
            "source_type": "youtube"
        }

    except Exception as e:
        logging.error(f"Transcription error: {e}")
        return None

def transcribe_local_video(file_path):
    """Transcribe a local video file"""
    try:
        result = whisper_model.transcribe(
            file_path,
            task="translate",
            temperature=0,
            condition_on_previous_text=False,
            word_timestamps=True
        )
        
        return {
            "text": result["text"],
            "segments": result["segments"],
            "source_type": "local"
        }
    except Exception as e:
        logging.error(f"Local video transcription error: {e}")
        return None

def generate_summary(text):
    """Generate summary using BART model"""
    if not text or len(text.strip()) < 50:
        return "Text too short for summarization."
    
    try:
        inputs = bart_tokenizer.encode(
            text,
            return_tensors="pt",
            max_length=512,
            truncation=True
        ).to(device)

        summary_ids = bart_model.generate(
            inputs,
            max_length=150,
            min_length=50,
            num_beams=4,
            early_stopping=True
        )

        return bart_tokenizer.decode(summary_ids[0], skip_special_tokens=True)
    except Exception as e:
        logging.error(f"Summary generation error: {e}")
        return "Error generating summary."

def clean_transcription_text(text):
    """Clean transcription text to be a continuous paragraph"""
    if not text:
        return ""
    # Replace multiple spaces/newlines with single space
    cleaned = re.sub(r'\s+', ' ', text).strip()
    return cleaned

def get_or_create_transcription(video_url, generate_new=False):
    """Helper function to get existing transcription or create new one"""
    record = collection.find_one({"url": video_url})
    
    if record and not generate_new:
        return record
    
    # If not in database or forced to generate new, transcribe the video
    if video_url.startswith("local://"):
        return None
    
    data = download_video_and_transcribe(video_url)
    if not data:
        return None
    
    # Clean the transcription text
    full_text = clean_transcription_text(data["text"])
    
    # Generate summary
    summary = generate_summary(full_text)
    
    # Create/update document in database
    document = {
        "url": video_url,
        "transcript": full_text,
        "segments": data["segments"],
        "summary": summary,
        "source_type": data.get("source_type", "youtube"),
        "date_processed": datetime.utcnow()
    }
    
    if record:
        # Update existing record
        collection.update_one({"url": video_url}, {"$set": document})
    else:
        # Insert new record
        collection.insert_one(document)
    
    return document

# API ROUTES

# STATIC SUMMARY 
@app.route("/api/process", methods=["POST"])
def process_video():
    video_url = request.json.get("url")
    
    # Check if it's a local file
    if video_url.startswith("local://"):
        # Look up local file in database
        record = collection.find_one({"url": video_url})
        if record:
            return jsonify({
                "success": True,
                "summary": record["summary"],
                "transcription": record.get("transcript", ""),
                "cached": True
            })
        else:
            return jsonify({"success": False, "error": "Local video not found"}), 404
    
    # Get or create transcription for YouTube URL
    result = get_or_create_transcription(video_url)
    if not result:
        return jsonify({"success": False, "error": "Transcription failed"}), 400
    
    return jsonify({
        "success": True,
        "summary": result["summary"],
        "transcription": result.get("transcript", ""),
        "cached": "date_processed" in result
    })

# VIDEO UPLOAD ENDPOINT
@app.route("/api/upload_video", methods=["POST"])
def upload_video():
    """Handle local video upload and processing"""
    try:
        if 'video' not in request.files:
            return jsonify({"success": False, "error": "No video file provided"}), 400
        
        file = request.files['video']
        
        if file.filename == '':
            return jsonify({"success": False, "error": "No video selected"}), 400
        
        if not allowed_file(file.filename):
            return jsonify({
                "success": False, 
                "error": f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
            }), 400
        
        # Generate unique filename
        filename = secure_filename(file.filename)
        unique_id = uuid.uuid4().hex
        unique_filename = f"{unique_id}_{filename}"
        file_path = os.path.join("uploads", unique_filename)
        
        # Save the file temporarily
        file.save(file_path)
        
        # Check file size
        file_size = os.path.getsize(file_path)
        if file_size > MAX_CONTENT_LENGTH:
            os.remove(file_path)
            return jsonify({
                "success": False, 
                "error": f"File too large. Maximum size is {MAX_CONTENT_LENGTH // (1024*1024)}MB"
            }), 400
        
        # Calculate video hash for content recognition
        video_hash = calculate_video_hash(file_path)
        
        # Check if this video already exists in database by hash
        existing_video = None
        if video_hash:
            existing_video = collection.find_one({
                "source_type": "local",
                "video_hash": video_hash
            })
        
        # If video already exists, return cached results
        if existing_video:
            # Clean up temp file
            os.remove(file_path)
            
            # Check if the existing video still has valid transcript
            if existing_video.get("transcript") and existing_video.get("summary"):
                return jsonify({
                    "success": True,
                    "summary": existing_video["summary"],
                    "transcription": existing_video.get("transcript", ""),
                    "url": existing_video["url"],
                    "filename": existing_video.get("original_filename", filename),
                    "file_size": existing_video.get("file_size", file_size),
                    "cached": True,
                    "message": "Video already processed. Using cached results."
                })
        
        # If not cached or cache invalid, transcribe the video
        logging.info(f"Transcribing local video: {filename}")
        data = transcribe_local_video(file_path)
        
        if not data:
            os.remove(file_path)
            return jsonify({"success": False, "error": "Transcription failed"}), 500
        
        # Clean transcription text
        full_text = clean_transcription_text(data["text"])
        
        # Generate summary
        summary = generate_summary(full_text)
        
        # Create unique URL for local file
        local_url = f"local://{unique_id}"
        
        # Store in database
        document = {
            "url": local_url,
            "transcript": full_text,
            "segments": data["segments"],
            "summary": summary,
            "source_type": "local",
            "original_filename": filename,
            "file_size": file_size,
            "video_hash": video_hash,
            "date_processed": datetime.utcnow()
        }
        
        # If there was an existing video with same hash, update it
        if existing_video:
            # Update existing record with new data
            collection.update_one(
                {"video_hash": video_hash, "source_type": "local"},
                {"$set": document}
            )
            # Use the existing URL instead of creating new one
            local_url = existing_video["url"]
            document["url"] = local_url
        else:
            # Insert new record
            collection.insert_one(document)
        
        # Clean up uploaded file
        if os.path.exists(file_path):
            os.remove(file_path)
        
        return jsonify({
            "success": True,
            "summary": summary,
            "transcription": full_text,
            "url": local_url,
            "filename": filename,
            "file_size": file_size,
            "cached": existing_video is not None
        })
        
    except Exception as e:
        logging.error(f"Upload error: {e}")
        # Clean up file if it exists
        if 'file_path' in locals() and os.path.exists(file_path):
            os.remove(file_path)
        return jsonify({"success": False, "error": str(e)}), 500
        
# FULL TRANSCRIPTION
@app.route("/api/full_transcription", methods=["POST"])
def full_transcription():
    video_url = request.json.get("url")
    
    # Check if it's a local file
    if video_url.startswith("local://"):
        record = collection.find_one({"url": video_url})
        if not record:
            return jsonify({"success": False, "error": "Local video not found"}), 404
        
        return jsonify({
            "success": True,
            "transcription": record.get("transcript", ""),
            "summary": record.get("summary", ""),
            "cached": True
        })
    
    # Get or create transcription for YouTube URL
    result = get_or_create_transcription(video_url)
    if not result:
        return jsonify({"success": False, "error": "Transcription failed"}), 400
    
    return jsonify({
        "success": True,
        "transcription": result.get("transcript", ""),
        "summary": result.get("summary", ""),
        "cached": "date_processed" in result  
    })

# CHECK URL
@app.route("/api/check_url", methods=["POST"])
def check_url():
    url = request.json.get("url")
    record = collection.find_one({"url": url})
    return jsonify({
        "exists": record is not None,
        "source_type": record.get("source_type", "youtube") if record else None
    })

# DYNAMIC TEXT 
@app.route("/api/dynamic_summary", methods=["POST"])
def dynamic_summary():
    data = request.json
    video_url = data.get("url")
    start_time = float(data.get("startTime", 0))
    end_time = float(data.get("endTime", 0))

    if start_time >= end_time:
        return jsonify({
            "success": False,
            "error": "Invalid time range"
        }), 400

    record = collection.find_one({"url": video_url})
    if not record:
        return jsonify({
            "success": False,
            "error": "Video not found. Please process the video first."
        }), 400

    extracted_words = []

    # WORD-LEVEL TIMELINE FILTER
    for segment in record.get("segments", []):
        for word in segment.get("words", []):
            if word["start"] >= start_time and word["end"] <= end_time:
                extracted_words.append(word["word"])

    if not extracted_words:
        return jsonify({
            "success": True,
            "text": "No words between the given timeline"
        })

    return jsonify({
        "success": True,
        "text": " ".join(extracted_words)
    })

# TRANSLATION
@app.route("/api/translate", methods=["POST"])
def translate_summary():
    summary = request.json.get("summary")
    target = request.json.get("target_language")

    if not summary or not target:
        return jsonify({"success": False, "error": "Missing parameters"}), 400

    try:
        translator = Translator()
        translated = translator.translate(summary, dest=target).text
        return jsonify({
            "success": True,
            "translated_summary": translated
        })
    except Exception as e:
        logging.error(f"Translation error: {e}")
        return jsonify({
            "success": False,
            "error": "Translation failed"
        }), 500

# GET UPLOADED VIDEOS
@app.route("/api/uploaded_videos", methods=["GET"])
def get_uploaded_videos():
    """Get list of all uploaded local videos"""
    try:
        videos = list(collection.find(
            {"source_type": "local"}, 
            {"_id": 0, "url": 1, "original_filename": 1, "date_processed": 1, "file_size": 1}
        ).sort("date_processed", -1).limit(50))
        
        for video in videos:
            video["date_processed"] = video["date_processed"].isoformat() if video.get("date_processed") else None
        
        return jsonify({
            "success": True,
            "videos": videos
        })
    except Exception as e:
        logging.error(f"Error fetching uploaded videos: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# DELETE UPLOADED VIDEO
@app.route("/api/delete_video/<video_url>", methods=["DELETE"])
def delete_video(video_url):
    """Delete an uploaded video from database"""
    try:
        if not video_url.startswith("local://"):
            return jsonify({"success": False, "error": "Invalid video URL"}), 400
        
        result = collection.delete_one({"url": video_url})
        
        if result.deleted_count > 0:
            return jsonify({"success": True, "message": "Video deleted successfully"})
        else:
            return jsonify({"success": False, "error": "Video not found"}), 404
    except Exception as e:
        logging.error(f"Error deleting video: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# TEXT TO SPEECH (gTTS)
@app.route("/api/tts", methods=["POST"])
def text_to_speech():
    """Convert text to speech using gTTS"""
    try:
        data = request.json
        text = data.get("text", "")
        language = data.get("language", "en")
        speech_rate = data.get("rate", 1.0)
        
        if not text:
            return jsonify({"success": False, "error": "No text provided"}), 400
        
        # Truncate very long text to avoid issues
        if len(text) > 2000:
            text = text[:2000] + "..."
        
        # Generate unique filename
        filename = f"tts_{uuid.uuid4().hex}.mp3"
        filepath = os.path.join("static/audio", filename)
        
        # Generate speech using gTTS
        tts = gTTS(text=text, lang=language, slow=False)
        tts.save(filepath)
        
        return jsonify({
            "success": True,
            "audio_url": f"/static/audio/{filename}",
            "rate": speech_rate
        })
        
    except Exception as e:
        logging.error(f"TTS error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# LANGUAGES
@app.route("/api/languages", methods=["GET"])
def languages():
    return jsonify({
        "success": True,
        "languages": {
            "en": "English",
            "ta": "Tamil",
            "hi": "Hindi",
            "fr": "French",
            "de": "German",
            "es": "Spanish",
            "zh-cn": "Chinese",
            "ja": "Japanese",
            "ko": "Korean",
            "ru": "Russian",
            "ar": "Arabic",
            "pt": "Portuguese",
            "it": "Italian",
            "nl": "Dutch",
            "pl": "Polish",
            "tr": "Turkish",
            "vi": "Vietnamese",
            "th": "Thai",
            "id": "Indonesian",
            "ms": "Malay"
        }
    })

# HEALTH CHECK
@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({
        "success": True,
        "message": "API is running",
        "timestamp": datetime.utcnow().isoformat(),
        "upload_folder": os.path.exists("uploads"),
        "download_folder": os.path.exists("downloads"),
        "audio_folder": os.path.exists("static/audio")
    })

# Clean up old temporary files
def cleanup_temp_files():
    """Clean up old temporary files in uploads and audio folders"""
    try:
        # Clean audio files
        audio_dir = Path("static/audio")
        if audio_dir.exists():
            for file_path in audio_dir.iterdir():
                if file_path.suffix == '.mp3':
                    # Remove audio files older than 1 hour
                    if file_path.stat().st_mtime < (datetime.now().timestamp() - 3600):
                        file_path.unlink()
                        logging.info(f"Cleaned up old audio file: {file_path.name}")
        
        # Clean upload files
        upload_dir = Path("uploads")
        if upload_dir.exists():
            for file_path in upload_dir.iterdir():
                # Remove files older than 1 hour
                if file_path.stat().st_mtime < (datetime.now().timestamp() - 3600):
                    file_path.unlink()
                    logging.info(f"Cleaned up old file: {file_path.name}")
    except Exception as e:
        logging.error(f"Error cleaning up temp files: {e}")

# RUN
if __name__ == "__main__":
    # Clean up on startup
    cleanup_temp_files()
    app.run(debug=True, port=5001)