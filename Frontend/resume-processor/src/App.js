import React, { useState } from "react";
import axios from "axios";
import "./App.css"; // import css

function App() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const [dragActive, setDragActive] = useState(false);

  // 🆕 New Form Fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // 📂 File Handlers
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

      // You could also send form data (firstName, etc.) to your backend here
      console.log("Form Data:", { firstName, lastName, dob, email, phone });

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
        <h2 className="title">Resume Screening</h2>

        {/* Description */}

        {/* 🆕 Personal Details Form */}
        <div className="form-section">
          <input
            type="text"
            placeholder="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="form-input"
          />
          <input
            type="text"
            placeholder="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="form-input"
          />
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="form-input"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="form-input"
          />
          <input
            type="tel"
            placeholder="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="form-input"
          />
        </div>

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
        </div>
      </div>
    </div>
  );
}

export default App;
