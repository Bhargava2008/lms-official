document.addEventListener("DOMContentLoaded", () => {
  // Check if user is authenticated
  if (!localStorage.getItem("accessToken")) {
    window.location.href = "/login.html";
    return;
  }

  async function getToken() {
    let token = localStorage.getItem("accessToken");

    if (!token) {
      console.log("No token found in storage");
      return null;
    }

    // Check if token is expired
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const expiry = payload.exp * 1000;
      if (Date.now() >= expiry - 60000) {
        console.log("Token expired or about to expire, refreshing...");
        token = await refreshAccessToken();
      }
    } catch (error) {
      console.error("Error parsing token:", error);
      return null;
    }

    return token;
  }

  async function refreshAccessToken() {
    try {
      const response = await fetch("/refresh", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        console.error("Refresh token invalid or expired");
        logout();
        return null;
      }

      const data = await response.json();
      localStorage.setItem("accessToken", data.accessToken);
      return data.accessToken;
    } catch (err) {
      console.error("Error refreshing token:", err);
      logout();
      return null;
    }
  }

  async function makeAuthenticatedRequest(url, options = {}) {
    let token = await getToken();

    if (!token) {
      throw new Error("No authentication token available");
    }

    const config = {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      credentials: "include",
    };

    let response = await fetch(url, config);

    // If token is expired or invalid, try to refresh and retry once
    if (response.status === 403 || response.status === 401) {
      console.log("Access denied, attempting token refresh...");
      token = await refreshAccessToken();

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        response = await fetch(url, config);
      }
    }

    // If still unauthorized after refresh, handle it
    if (response.status === 403 || response.status === 401) {
      console.log("Still unauthorized after refresh, redirecting to login");
      logout();
      throw new Error("Authentication failed");
    }

    return response;
  }

  async function logout() {
    try {
      // Call logout endpoint to clear refresh token
      await fetch("/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout API call failed:", error);
    } finally {
      // Clear local storage
      localStorage.removeItem("accessToken");
      localStorage.removeItem("userRole");
      localStorage.removeItem("userId");
      localStorage.removeItem("user");

      // Redirect to login page
      window.location.href = "/login.html";
    }
  }

  // Form submission handler
  document
    .getElementById("addBookForm")
    .addEventListener("submit", async function (e) {
      e.preventDefault();

      const bookName = document.getElementById("bookName").value;
      const authorName = document.getElementById("authorName").value;
      const isbn = document.getElementById("isbn").value;
      const department = document.getElementById("department").value;

      console.log("Attempting to add book with data:", {
        bookName,
        authorName,
        isbn,
        department,
      });

      // Show loading state
      const submitButton = this.querySelector('button[type="submit"]');
      const originalText = submitButton.textContent;
      submitButton.disabled = true;
      submitButton.textContent = "Adding Book...";

      try {
        const response = await makeAuthenticatedRequest(
          "/api/librarian/books",
          {
            method: "POST",
            body: JSON.stringify({
              bookName,
              authorName,
              isbn,
              department,
            }),
          },
        );

        // Handle different response statuses
        if (response.status === 409) {
          // Book with same ISBN already exists
          const errorData = await response.json();
          throw new Error(
            errorData.message || "A book with this ISBN already exists",
          );
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to add book: ${response.status} - ${errorText}`,
          );
        }

        const result = await response.json();
        console.log("Book successfully added:", result);

        alert("✅ Book added successfully!");

        // Clear the form
        document.getElementById("addBookForm").reset();

        // Redirect to dashboard with manageBooks section active
        window.location.href =
          "/librarian-dashboard/librarian-dashboard.html?view=manageBooks";
      } catch (error) {
        console.error("Error adding book:", error);

        // Show specific error messages
        if (
          error.message.includes("already exists") ||
          error.message.includes("409")
        ) {
          alert(
            "❌ Book Addition Failed:\nA book with this ISBN already exists in the system.\n\nPlease use a different ISBN number.",
          );
        } else {
          alert("Error adding book: " + error.message);
        }
      } finally {
        // Reset button state
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    });
});
