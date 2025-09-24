import React, { useState } from "react";
import axios from "axios";

function App() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setStatus("");
  };

  const handleUpload = async () => {
    if (!file) {
      alert("Please select a PDF first!");
      return;
    }

    try {
      setStatus("Requesting upload URL...");

      // ✅ Use environment variable for backend URL
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      const res = await axios.get(`${backendUrl}/getPresignedUrl`);
      const { url } = res.data;

      setStatus("Uploading to S3...");

      // Upload file directly to S3
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
    <div style={{ padding: "40px", fontFamily: "Arial" }}>
      <h1>Upload PDF</h1>
      <input type="file" accept="application/pdf" onChange={handleFileChange} />
      <button onClick={handleUpload} style={{ marginLeft: "10px" }}>
        Upload
      </button>
      <p>{status}</p>
    </div>
  );
}

export default App;
