import React, { useState, useRef, useEffect } from 'react';
import './Upload.css';

const Upload = ({ onUploadSuccess, onUploadError, apiBase, onUrlChange, initialUrl = '' }) => {
  const [activeTab, setActiveTab] = useState('url'); // 'url' or 'file'
  const [videoUrl, setVideoUrl] = useState(initialUrl);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (onUrlChange) {
      onUrlChange(videoUrl);
    }
  }, [videoUrl, onUrlChange]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setUploadStatus(null);
    
    if (tab === 'url' && videoUrl) {
      // Keep the existing URL when switching to URL tab
    } else if (tab === 'file' && selectedFile) {
      // Keep the selected file when switching to file tab
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    processFile(file);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    
    const file = event.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file) => {
    if (!file) return;

    // Check file size (max 500MB)
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadStatus({
        type: 'error',
        message: `File size too large. Maximum size is ${maxSize / (1024 * 1024)}MB.`
      });
      return;
    }
    
    // Check file type by extension
    const fileExtension = file.name.split('.').pop().toLowerCase();
    const allowedExtensions = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv', 'wmv', 'm4v', 'mpg', 'mpeg', '3gp'];
    
    if (!allowedExtensions.includes(fileExtension)) {
      setUploadStatus({
        type: 'error',
        message: 'Invalid file type. Please upload a video file.'
      });
      return;
    }
    
    setSelectedFile(file);
    setUploadStatus(null);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setUploadStatus(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadStatus({
        type: 'error',
        message: 'Please select a video file first.'
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus(null);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 300);

      const formData = new FormData();
      formData.append('video', selectedFile);

      const response = await fetch(`${apiBase}/upload_video`, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await response.json();
      
      if (data.success) {
        setUploadStatus({
          type: 'success',
          message: 'Video uploaded and processed successfully!'
        });
        
        // Set the generated URL and switch to URL tab
        setVideoUrl(data.url);
        setActiveTab('url');
        
        if (onUploadSuccess) {
          onUploadSuccess(data);
        }
        
        // Clear file selection after successful upload
        setTimeout(() => {
          setSelectedFile(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          setUploadProgress(0);
        }, 1500);
      } else {
        setUploadStatus({
          type: 'error',
          message: data.error || 'Upload failed. Please try again.'
        });
        if (onUploadError) {
          onUploadError(data.error);
        }
      }
    } catch (error) {
      setUploadStatus({
        type: 'error',
        message: 'Network error. Please check your connection and try again.'
      });
      if (onUploadError) {
        onUploadError(error.message);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleUrlChange = (e) => {
    const newUrl = e.target.value;
    setVideoUrl(newUrl);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="upload-section">
      <div className="upload-tabs">
        <button
          className={`upload-tab ${activeTab === 'url' ? 'active' : ''}`}
          onClick={() => handleTabChange('url')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7"></polygon>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
          </svg>
          Video URL
        </button>
        
        <button
          className={`upload-tab ${activeTab === 'file' ? 'active' : ''}`}
          onClick={() => handleTabChange('file')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          Upload File
        </button>
      </div>
      
      <div className="upload-content">
        {activeTab === 'url' ? (
          <div className="url-input-container">
            <div className="input-wrapper">
              <input
                type="text"
                className="url-input"
                value={videoUrl}
                onChange={handleUrlChange}
                placeholder="Paste YouTube URL or enter local video URL"
              />
            </div>
            
            {uploadStatus && activeTab === 'url' && (
              <div className={`upload-status ${uploadStatus.type}`}>
                {uploadStatus.type === 'success' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                ) : uploadStatus.type === 'error' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                  </svg>
                ) : null}
                <span>{uploadStatus.message}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="file-upload-container">
            {!selectedFile ? (
              <div 
                className={`file-input-wrapper ${isDragging ? 'drag-over' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="file-input"
                  accept="video/*"
                  onChange={handleFileSelect}
                />
                <div className="upload-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                </div>
                <div className="upload-text">
                  Click to browse or drag & drop video file
                </div>
                <div className="upload-subtext">
                  Upload a video file from your computer
                </div>
                <button className="browse-button">
                  Browse Files
                </button>
              </div>
            ) : (
              <>
                <div className="selected-file">
                  <div className="file-info">
                    <div className="file-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <polyline points="16 10 12 6 8 10"></polyline>
                        <line x1="12" y1="6" x2="12" y2="15"></line>
                      </svg>
                    </div>
                    <div className="file-details">
                      <div className="file-name">{selectedFile.name}</div>
                      <div className="file-size">{formatFileSize(selectedFile.size)}</div>
                    </div>
                  </div>
                  
                  <div className="file-actions">
                    <button
                      type="button"
                      className="remove-file-btn"
                      onClick={handleRemoveFile}
                      disabled={isUploading}
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      className="upload-btn"
                      onClick={handleUpload}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <>
                          <div className="loading-spinner"></div>
                          Processing...
                        </>
                      ) : (
                        'Upload & Process'
                      )}
                    </button>
                  </div>
                </div>
                
                {isUploading && (
                  <div className="upload-progress">
                    <div className="progress-info">
                      <span className="progress-text">Uploading and processing video...</span>
                      <span className="progress-percentage">{uploadProgress}%</span>
                    </div>
                    <div className="progress-bar-container">
                      <div 
                        className="progress-bar" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </>
            )}
            
            {uploadStatus && activeTab === 'file' && (
              <div className={`upload-status ${uploadStatus.type}`}>
                {uploadStatus.type === 'success' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                ) : uploadStatus.type === 'error' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                  </svg>
                ) : null}
                <span>{uploadStatus.message}</span>
              </div>
            )}
            
            <div className="supported-formats">
              Supported formats: <span>MP4, AVI, MOV, MKV, WebM, FLV, WMV, MPG, 3GP</span> (Max 500MB)
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Upload;