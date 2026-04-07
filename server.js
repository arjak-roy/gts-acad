const http = require("http");

const server = http.createServer((req, res) => {
  // 1. Health check endpoint (for ECS/ALB compatibility)
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok" }));
  }

  // 2. Main application UI (HTML)
  res.writeHead(200, { "Content-Type": "text/html" });

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body, html {
          height: 100%;
          margin: 0;
          display: flex;
          justify-content: center; /* Horizontal centering */
          align-items: center;     /* Vertical centering */
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-image: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #333;
        }
        .container {
          text-align: center;
          padding: 40px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          box-shadow: 0 15px 35px rgba(0,0,0,0.2);
          width: 90%;
          max-width: 500px;
          transition: transform 0.3s ease;
        }
        .container:hover {
          transform: translateY(-5px);
        }
        h1 {
          color: #4a5568;
          margin-bottom: 20px;
          font-weight: 700;
        }
        .status-badge {
          display: inline-block;
          padding: 8px 16px;
          background-color: #48bb78;
          color: white;
          border-radius: 50px;
          font-size: 0.9rem;
          margin-top: 10px;
        }
      </style>
      <title>GTS Academy Admin</title>
    </head>
    <body>
      <div class="container">
        <h1>GTS Academy Admin</h1>
        <p>Deployment Successful!</p>
        <div class="status-badge">Service Healthy</div>
      </div>
    </body>
    </html>
  `;

  res.end(htmlContent);
});

// Explicitly listen on port 3000 to match EXPOSE in Dockerfile
server.listen(3000, () => {
  console.log("Server running on port 3000");
});