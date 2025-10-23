// HomePage.js
import React from "react";
import { useNavigate } from "react-router-dom";
import "./App.css"; // Reuse same styling or create a new CSS file

function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="home-container">
      <h1>Welcome to Resume-to-Job Match</h1>
      <p>
        Upload your resume and explore job roles that best match your skills and
        experience.
      </p>

      <button className="primary-btn" onClick={() => navigate("/dashboard")}>
        Go to Dashboard
      </button>
    </div>
  );
}

export default HomePage;
