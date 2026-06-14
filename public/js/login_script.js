document
  .getElementById("loginForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const message = document.getElementById("message");

    // Clear previous messages
    message.textContent = "";

    if (username === "" || password === "") {
      message.style.color = "#f87171";
      message.textContent = "Please fill in all fields!";
      return;
    }

    try {
      const response = await fetch("fetch(`${window.API_BASE_URL}/auth`)", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: username, pwd: password }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          message.style.color = "#f87171";
          message.textContent = "Invalid username or password.";
        } else if (response.status === 400) {
          message.style.color = "#f87171";
          message.textContent = "Bad request. Please check your input.";
        } else {
          message.style.color = "#f87171";
          message.textContent = `Login failed. Server error: ${response.status}`;
        }
        return;
      }

      const data = await response.json();

      if (data.accessToken && data.role) {
        const accessToken = data.accessToken;
        const userRole = data.role;

        // --- STORE USER DATA IN LOCALSTORAGE ---
        localStorage.setItem("accessToken", accessToken);
        localStorage.setItem("userRole", userRole);
        localStorage.setItem("userId", username); // Store the username as userId

        // Also store complete user info for easy access
        const userInfo = {
          id: username, // This is the student ID
          role: userRole,
          username: username,
        };
        localStorage.setItem("user", JSON.stringify(userInfo));

        console.log("Login successful - Stored user data:", userInfo);

        // Determine redirect URL based on role
        let redirectUrl = "";
        switch (userRole) {
          case "student":
            redirectUrl = "/student-dashboard.html";
            break;
          case "librarian":
            redirectUrl = "/librarian-dashboard.html";
            break;
          case "admin":
            redirectUrl = "/admin-dashboard.html";
            break;
          default:
            message.style.color = "#f87171";
            message.textContent = "Unknown user role: " + userRole;
            return;
        }

        // Show success message
        message.style.color = "#4ade80";
        message.textContent = `Login successful! Redirecting to ${userRole} dashboard...`;

        // Add a small delay to show the success message
        setTimeout(() => {
          window.location.replace(redirectUrl);
        }, 1000);
      } else {
        message.style.color = "#f87171";
        message.textContent = "Login failed. Invalid server response.";
      }
    } catch (error) {
      message.style.color = "#f87171";

      if (error.name === "TypeError" && error.message.includes("fetch")) {
        message.textContent =
          "Network error. Please check if the server is running.";
      } else {
        message.textContent = "An unexpected error occurred. Please try again.";
      }
    }
  });

// Password visibility toggle
const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");

if (togglePassword && passwordInput) {
  togglePassword.addEventListener("click", () => {
    const type = passwordInput.getAttribute("type");
    if (type === "password") {
      passwordInput.setAttribute("type", "text");
      togglePassword.textContent = "🙈";
    } else {
      passwordInput.setAttribute("type", "password");
      togglePassword.textContent = "👁️";
    }
  });
}
