import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import "./App.css";

function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const navigate = useNavigate();
  const { jobId } = useParams();

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (!user) navigate("/");

    // ✅ Fetch all job roles
    const fetchJobs = async () => {
      try {
        const backendUrl = process.env.REACT_APP_BACKEND_URL;
        const res = await axios.get(`${backendUrl}/getJobRoles`);
        const jobList = res.data;
        setJobs(jobList);

        // If route has /jobs/:jobId, pre-select that job
        if (jobId) {
          const found = jobList.find((j) => j.id === jobId);
          if (found) setSelectedJob(found);
        } else if (jobList.length > 0) {
          setSelectedJob(jobList[0]);
        }
      } catch (err) {
        console.error("Error fetching jobs:", err);
      }
    };

    fetchJobs();
  }, [navigate, jobId]);

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
      const backendUrl = process.env.REACT_APP_BACKEND_URL;

      // ✅ Send jobId along with file name
      const res = await axios.get(`${backendUrl}/getPresignedUrl`, {
        params: { name: file.name, jobId: selectedJob.id },
      });

      const { url } = res.data;
      setStatus("Uploading PDF to S3...");

      // ✅ Upload to S3
      await axios.put(url, file, {
        headers: { "Content-Type": "application/pdf" },
      });

      setStatus("✅ Successfully uploaded to S3!");
      setFile(null);
    } catch (err) {
      console.error("Upload error:", err);
      setStatus("❌ Failed to upload file");
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
        <h3>Job Roles</h3>
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
      </div>

      {/* Main Content */}
      <div className="main-content">
        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>

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
      </div>
    </div>
  );
}

export default Dashboard;
