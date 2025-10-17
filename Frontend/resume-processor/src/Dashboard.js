import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import "./App.css";

function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const { jobId } = useParams();

  // Normalize base URL (remove any trailing slash)
  const backendBase = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (!user) navigate("/");

    const fetchJobs = async () => {
      setLoading(true);
      setError("");
      try {
        // GET /getJobRoles → returns a list of jobs
        const res = await axios.get(`${backendBase}/getJobRoles`);
        const jobList = Array.isArray(res.data) ? res.data : [];
        setJobs(jobList);

        // Pre-select from route /jobs/:jobId, or default to first
        if (jobId) {
          const found = jobList.find((j) => j.id === jobId);
          if (found) setSelectedJob(found);
          else if (jobList.length > 0) setSelectedJob(jobList[0]);
        } else if (jobList.length > 0) {
          setSelectedJob(jobList[0]);
        }
      } catch (err) {
        console.error("Error fetching jobs:", err);
        setError("Failed to load job roles. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, [navigate, jobId, backendBase]);

  const handleJobClick = (job) => {
    setSelectedJob(job);
    navigate(`/jobs/${job.id}`);
  };

  const handleFileChange = (e) => setFile(e.target.files[0]);
  const handleRemoveFile = () => setFile(null);

  const handleSubmit = async () => {
    if (!file) return alert("Please upload a PDF first!");
    if (!selectedJob) return alert("Please select a job role!");

    try {
      setStatus("Requesting upload URL...");
      setError("");

      // GET /getPresignedUrl?name=...&jobId=...
      const res = await axios.get(`${backendBase}/getPresignedUrl`, {
        params: { name: file.name, jobId: selectedJob.id },
      });

      const { url } = res.data || {};
      if (!url) {
        setStatus("");
        setError("Did not receive a presigned URL from the server.");
        return;
      }

      setStatus("Uploading PDF to S3...");
      await axios.put(url, file, {
        headers: { "Content-Type": "application/pdf" },
      });

      setStatus("✅ Successfully uploaded to S3!");
      setFile(null);
    } catch (err) {
      console.error("Upload error:", err);
      setStatus("");
      setError("❌ Failed to upload file");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/");
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h3>Job Roles</h3>
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
        {loading ? (
          <p>Loading roles…</p>
        ) : (
          <ul>
            {jobs.map((job) => (
              <li
                key={job.id}
                className={selectedJob?.id === job.id ? "active" : ""}
                onClick={() => handleJobClick(job)}
              >
                {job.title}
              </li>
            ))}
          </ul>
        )}
        {error && <p className="error">{error}</p>}
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Job Title */}
        <h2>{selectedJob?.title || "Select a Role"}</h2>

        {/* Job Description */}
        {selectedJob && (
          <div className="job-description-box">
            <h3>Job Description</h3>
            <p>{selectedJob.description || "No description available."}</p>
          </div>
        )}

        {/* Upload Section */}
        <p className="job-desc">
          Upload your resume to analyze how well it fits this role.
        </p>

        <div className="upload-section">
          <label
            htmlFor="fileUpload"
            className="upload-box"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files.length > 0) {
                setFile(e.dataTransfer.files[0]);
              }
            }}
          >
            <img src="pdf-icon.jpg" alt="upload" className="upload-icon" />

            {file ? (
              <div className="file-preview">
                <p>📄 {file.name}</p>
                <button
                  type="button"
                  className="remove-btn"
                  onClick={handleRemoveFile}
                >
                  ✖ Remove
                </button>
              </div>
            ) : (
              <p>Drag & drop your resume here or click to browse</p>
            )}

            <input
              id="fileUpload"
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="file-input-hidden"
            />
          </label>

          <button onClick={handleSubmit} className="upload-btn">
            Upload & Submit
          </button>
        </div>

        {status && <p className="status">{status}</p>}
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}

export default Dashboard;
