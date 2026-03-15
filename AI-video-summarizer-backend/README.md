# Real-Time AI Video Summarization and Multi-Language Translation

## Introduction

In the digital age, video content consumption has surged, creating a need for efficient summarization tools. This project aims to tackle this challenge by developing an AI-powered video summarization system. The system provides users with concise summaries of videos uploaded from local devices or URLs, supports multi-language translation, and offers dynamic, time-specific summarization features.

## Key Features

### 1. Video Upload

- Enables input of video URLs for summarization.

### 2. Summarization

- Generates concise for lengthy videos.
- Employs advanced AI techniques for accurate summarization.

### 3. Multi-Language Support

- Translates summaries into multiple languages for global accessibility.
- Utilizes advanced translation models to ensure accuracy.

### 4. Download Summaries

- Allows users to download video summaries.

### 5. Dynamic Summarization

- Offers real-time summarization by providing time-specific summaries based on user input (e.g., "from minute X to minute Y").

## System Architecture

- **Backend:** Flask framework for API handling and logic.
- **Frontend:** User-friendly interface for uploading videos, selecting summary options, and downloading results.
- **Model:** Fine-tuned BART model for summarization.
- **Database:** MongoDB Atlas for storing video URLs and transcripts.

## Project Setup

### Prerequisites

- Python 3.8+
- Flask
- MongoDB Atlas account
- Pre-trained BART model

### Installation

1. Clone the repository.
   ```bash
   git clone <repository_url>
   cd <repository_folder>
   ```
2. Install dependencies.
   ```bash
   pip install -r requirements.txt
   ```
3. Set up the MongoDB URI in the `.env` file.
   ```
   MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/<dbname>
   ```
4. Run the application.
   ```bash
   python app.py
   ```
5. Access the application at `http://localhost:5000`.

## Usage

### Static Summarization

1. **Input Video URL:** Provide a URL of the video to be summarized.
2. **Translate Summary:** After obtaining the summary, click the "Translate" button, select the desired language, and click "Translate."
3. **Download Summary:** To download the summary, click the "Download" button.

### Dynamic Summarization

1. **Time-Specific Input:** Specify the "from" time and "to" time for the desired segment.
2. **Generate Summary:** Click the "Generate Summary" button to obtain the summary for the specified segment.
## Screenshots and Output

### Static Summarization

1. **Home Page:**
   [view image](./images/homepage.jpg)
   

2. **Static Summary:**
   [view image](./images/static.jpg)
  

3. **Translation and Download**
   [view image](./images/translate&download.jpg)
   

### Dynamic Summarization

1. **Dynamic Summary:**
   [view image](./images/dyanamic.jpg)

## License

This project is provided under an "All Rights Reserved" license. Redistribution, modification, or commercial use of the software is prohibited without explicit permission from the author(s). The software is provided "as is" without any warranties or guarantees.

