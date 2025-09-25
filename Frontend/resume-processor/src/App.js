import React, { useState } from "react";
import axios from "axios";
import "./App.css"; // import css

function App() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setStatus("");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setStatus("");
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleRemoveFile = () => {
    setFile(null);
    setStatus("");
  };

  const handleUpload = async () => {
    if (!file) {
      alert("Please select a PDF first!");
      return;
    }

    try {
      setStatus("Requesting upload URL...");

      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      const res = await axios.get(`${backendUrl}/getPresignedUrl`, {
        params: { name: file.name },
      });
      const { url } = res.data;

      setStatus("Uploading to S3...");

      await axios.put(url, file, {
        headers: { "Content-Type": "application/pdf" },
      });

      setStatus("✅ Upload successful!");
    } catch (err) {
      console.error("Upload error:", err);
      setStatus("❌ Upload failed.");
    }
  };

  return (
    <div className="app-container">
      <div className="card">
        {/* Title */}
        <h2 className="title">Automated Document Processing</h2>

        {/* Architecture Image */}
        <img
          src="/architecture.jpg"
          alt="Architecture Diagram"
          className="architecture-img"
        />

        {/* Description */}
        <p className="description">
          Upload PDFs into <b>AWS S3</b> and let <b>AWS Lambda</b> trigger{" "}
          <b>Gemini AI</b> for intelligent processing. Results are sent via{" "}
          <b>AWS SNS</b> and delivered to <b>Gmail</b> in real-time.
        </p>

        {/* Upload Section */}
        <div
          className={`upload-box ${dragActive ? "drag-active" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <img src="/pdf-icon.jpg" alt="Upload PDF" className="upload-icon" />

          {file ? (
            <div className="file-preview">
              <p>📄 {file.name}</p>
              <button className="remove-btn" onClick={handleRemoveFile}>
                ❌ Remove
              </button>
            </div>
          ) : (
            <p>
              Drag & Drop your PDF here or{" "}
              <label htmlFor="file-upload" className="browse">
                browse
              </label>
            </p>
          )}

          <input
            id="file-upload"
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="file-input-hidden"
          />
        </div>

        <button onClick={handleUpload} className="upload-btn">
          Upload PDF
        </button>

        {/* Status */}
        {status && (
          <p
            className={`status ${
              status.includes("✅")
                ? "success"
                : status.includes("❌")
                ? "error"
                : "info"
            }`}
          >
            {status}
          </p>
        )}

        {/* Footer */}
        <div className="footer">
          <div>
            <b>Project Created By:</b>
            <div className="creators">
              <span className="badge">Tejas Manu</span>
              <span className="badge">Bhavya</span>
              <span className="badge">Pavan</span>
              <span className="badge">Lahari</span>
            </div>
          </div>
          <div>
            <b>Location:</b> Cloud Native • AWS Infrastructure
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
