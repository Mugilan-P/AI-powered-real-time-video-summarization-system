import React, { useState, useEffect, useRef } from 'react';
import './FullTranscription.css';
import Upload from './Upload';

const FullTranscription = () => {
  const [videoUrl, setVideoUrl] = useState('');
  const [transcription, setTranscription] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [languages, setLanguages] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [showSpeechRateDropdown, setShowSpeechRateDropdown] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [audioState, setAudioState] = useState('stopped');
  const [audioLoading, setAudioLoading] = useState(false);
  const [error, setError] = useState('');
  
  const dropdownRef = useRef(null);
  const speechDropdownRef = useRef(null);
  const audioRef = useRef(null);
  const clickTimeoutRef = useRef(null);
  const lastClickTimeRef = useRef(0);

  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5001/api';

  useEffect(() => {
    fetchLanguages();
    
    // Close dropdowns when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowLanguageDropdown(false);
      }
      if (speechDropdownRef.current && !speechDropdownRef.current.contains(event.target)) {
        setShowSpeechRateDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      // Clean up audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      // Clear timeouts
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  const fetchLanguages = async () => {
    try {
      const response = await fetch(`${API_BASE}/languages`);
      const data = await response.json();
      if (data.success) {
        setLanguages(Object.entries(data.languages));
      }
    } catch (error) {
      console.error('Failed to fetch languages:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!videoUrl) {
      setError('Please enter a video URL or upload a video first.');
      return;
    }

    setLoading(true);
    setError('');
    setTranscription('');
    
    try {
      const response = await fetch(`${API_BASE}/full_transcription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl }),
      });
      const data = await response.json();
      
      if (data.success) {
        setTranscription(data.transcription);
      } else {
        setError(`Error: ${data.error || 'Failed to fetch transcription'}`);
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
      setShowLanguageDropdown(false);
    }
  };

  const handleUploadSuccess = (data) => {
    setVideoUrl(data.url);
    setTranscription(data.transcription);
    setError('');
  };

  const handleUploadError = (error) => {
    setError(`Upload Error: ${error}`);
  };

  const handleUrlChange = (url) => {
    setVideoUrl(url);
  };

  const handleTranslate = async (languageCode) => {
    if (!languageCode || !transcription) return;

    setIsTranslating(true);
    try {
      const response = await fetch(`${API_BASE}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: transcription,
          target_language: languageCode,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setTranscription(data.translated_summary);
        setSelectedLanguage(languageCode);
        if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      setAudioState('stopped');
      }
    } catch (error) {
      console.error('Translation failed:', error);
    } finally {
      setIsTranslating(false);
      setShowLanguageDropdown(false);
    }
  };

  const generateAudio = async () => {
    if (!transcription) return null;
    
    try {
      const response = await fetch(`${API_BASE}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: transcription.length > 2000 ? transcription.substring(0, 2000) + "..." : transcription,
          language: selectedLanguage || "en",
          rate: speechRate
        }),
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("TTS error:", error);
      return null;
    }
  };

  const handleAudioClick = async (e) => {
    e.preventDefault();
    
    // Handle right click for dropdown
    if (e.type === 'contextmenu') {
      e.preventDefault();
      if (!transcription) return;
      setShowSpeechRateDropdown(!showSpeechRateDropdown);
      return;
    }
    
    // Handle left click
    const currentTime = Date.now();
    const timeSinceLastClick = currentTime - lastClickTimeRef.current;
    
    // Check for double click (within 300ms)
    if (timeSinceLastClick < 300) {
      // Double click - handle pause/resume
      clearTimeout(clickTimeoutRef.current);
      handleDoubleClick();
    } else {
      // Single click - will be handled after timeout
      clickTimeoutRef.current = setTimeout(() => {
        handleSingleClick();
      }, 300);
    }
    
    lastClickTimeRef.current = currentTime;
  };

  const handleSingleClick = async () => {
    if (!transcription) return;
    
    // Single click: Play/Stop toggle
    if (audioState === 'stopped') {
      // Play from beginning
      await playAudio();
    } else {
      // Stop completely
      stopAudio();
    }
  };

  const handleDoubleClick = () => {
    if (!transcription) return;
    
    // Double click: Pause/Resume toggle
    if (audioState === 'playing') {
      pauseAudio();
    } else if (audioState === 'paused') {
      resumeAudio();
    }
  };

  const playAudio = async () => {
    setAudioLoading(true);
    
    // If we don't have an audio element or need to regenerate
    if (!audioRef.current) {
      const audioData = await generateAudio();
      if (!audioData || !audioData.success) {
        alert("Text-to-speech generation failed");
        setAudioLoading(false);
        return;
      }
      
      const baseUrl = API_BASE.replace('/api', '');
      const audioUrl = `${baseUrl}${audioData.audio_url}`;
      
      const audio = new Audio(audioUrl);
      audio.playbackRate = speechRate;
      
      audio.onended = () => {
        setAudioState('stopped');
      };
      
      audio.onerror = () => {
        setAudioState('stopped');
        setAudioLoading(false);
      };
      
      audio.oncanplaythrough = () => {
        setAudioLoading(false);
      };
      
      audioRef.current = audio;
    }
    
    if (audioRef.current) {
      audioRef.current.currentTime = 0; // Start from beginning
      audioRef.current.play();
      setAudioState('playing');
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setAudioState('stopped');
    }
  };

  const pauseAudio = () => {
    if (audioRef.current && audioState === 'playing') {
      audioRef.current.pause();
      setAudioState('paused');
    }
  };

  const resumeAudio = () => {
    if (audioRef.current && audioState === 'paused') {
      audioRef.current.play();
      setAudioState('playing');
    }
  };

  const handleSpeechRateChange = (rate) => {
    setSpeechRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
    setShowSpeechRateDropdown(false);
  };

  const handleDownload = () => {
    if (!transcription) return;

    const blob = new Blob([transcription], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'video_transcription.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = () => {
    if (!transcription) return;
    
    navigator.clipboard.writeText(transcription)
      .then(() => {
        const button = document.querySelector('.copy-btn');
        if (button) {
          const originalText = button.innerHTML;
          button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
          setTimeout(() => {
            button.innerHTML = originalText;
          }, 2000);
        }
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
      });
  };

  const toggleLanguageDropdown = () => {
    if (!transcription) return;
    setShowLanguageDropdown(!showLanguageDropdown);
  };

  const getSpeakButtonTitle = () => {
    if (audioLoading) return "Loading...";
    switch(audioState) {
      case 'playing': return "Single click: Stop | Double click: Pause | Right click: Speed";
      case 'paused': return "Single click: Stop | Double click: Resume | Right click: Speed";
      default: return "Single click: Play | Double click: N/A | Right click: Speed";
    }
  };

  const getSpeakButtonIcon = () => {
    if (audioLoading) {
      return <div className="mini-spinner"></div>;
    }
    
    switch(audioState) {
      case 'playing':
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
        );
      case 'paused':
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        );
      default:
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          </svg>
        );
    }
  };

  return (
    <div className="full-transcription-page">
      <div className="full-transcription-container">
        <h1>Full Video Transcription</h1>

        {/* Upload Component with Tabs */}
        <Upload
          onUploadSuccess={handleUploadSuccess}
          onUploadError={handleUploadError}
          apiBase={API_BASE}
          onUrlChange={handleUrlChange}
          initialUrl={videoUrl}
        />

        <form onSubmit={handleSubmit} className="transcription-form">
          <button type="submit" disabled={loading || !videoUrl}>
            {loading ? 'Transcribing...' : 'Get Full Transcription'}
          </button>
        </form>

        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <p>Transcribing video...</p>
          </div>
        )}

        {/* ALWAYS VISIBLE TRANSCRIPTION BOX */}
        <div className="transcription-box">
          <div className="transcription-border-icons">
            <div className="translate-container" ref={dropdownRef}>
              <button 
                className="border-icon-btn" 
                onClick={toggleLanguageDropdown}
                title="Translate Transcription"
                disabled={!transcription || isTranslating}
              >
                {isTranslating ? (
                  <div className="mini-spinner"></div>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                  </svg>
                )}
              </button>
              
              {showLanguageDropdown && transcription && (
                <div className="language-dropdown">
                  <div className="dropdown-header">
                    <span>Translate to:</span>
                  </div>
                  <div className="language-list">
                    {languages.map(([code, name]) => (
                      <div 
                        key={code} 
                        className={`language-item ${selectedLanguage === code ? 'selected' : ''}`}
                        onClick={() => handleTranslate(code)}
                      >
                        <span className="language-name">{name}</span>
                        {selectedLanguage === code && (
                          <span className="checkmark">✓</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Read Aloud Button */}
            <div className="speak-container" ref={speechDropdownRef}>
              <button 
                className="border-icon-btn" 
                onClick={handleAudioClick}
                onContextMenu={handleAudioClick}
                title={getSpeakButtonTitle()}
                disabled={!transcription || audioLoading}
              >
                {getSpeakButtonIcon()}
              </button>
              
              {showSpeechRateDropdown && transcription && (
                <div className="speech-rate-dropdown">
                  <div className="dropdown-header">
                    <span>Speech Speed:</span>
                  </div>
                  <div className="speech-rate-list">
                    {[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((rate) => (
                      <div
                        key={rate}
                        className={`speech-rate-item ${
                          speechRate === rate ? "selected" : ""
                        }`}
                        onClick={() => handleSpeechRateChange(rate)}
                      >
                        <span className="rate-name">
                          {rate === 1.0 ? "Normal" : `${rate}x`}
                        </span>
                        {speechRate === rate && (
                          <span className="checkmark">✓</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <button 
              className="border-icon-btn copy-btn"
              onClick={handleCopyToClipboard}
              title="Copy to Clipboard"
              disabled={!transcription}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            
            <button 
              className="border-icon-btn" 
              onClick={handleDownload}
              title="Download Transcription"
              disabled={!transcription}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>
          </div>
          
          <div className="transcription-header">
            <h3>Full Transcription:</h3>
          </div>
          
          <div className="transcription-content">
            {loading ? (
              <div className="loading-placeholder">
                <div className="small-spinner"></div>
                <p>Loading transcription...</p>
              </div>
            ) : error ? (
              <div className="error-message">
                {error}
              </div>
            ) : transcription ? (
              transcription
            ) : (
              'Upload a video or enter a URL to get the full transcription.'
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FullTranscription;