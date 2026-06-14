document.addEventListener("DOMContentLoaded", () => {
  let isSearchingBooks = false;
  let isSearchingUsers = false;
  let isSearchingReturns = false;
  let isSearchingFines = false;
  if (!localStorage.getItem("accessToken")) {
    window.location.href = "/login.html";
    return;
  }

  const overlay = document.querySelector(".overlay");
  let isProcessingReturn = false;
  window.currentIssueBookId = null;
  async function getToken() {
    let token = localStorage.getItem("accessToken");

    if (!token) {
      console.log("No token found in storage");
      logout();
      return null;
    }

    // Check if token is expired or about to expire
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const expiry = payload.exp * 1000;
      const timeUntilExpiry = expiry - Date.now();

      // Refresh if token expires in less than 2 minutes or is already expired
      if (timeUntilExpiry < 120000) {
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
      console.log("🔄 Attempting to refresh access token...");

      const response = await fetch("/refresh", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        console.error(
          "❌ Refresh token invalid or expired, status:",
          response.status,
        );

        // Check if it's a true auth error or server error
        if (response.status === 401 || response.status === 403) {
          logout();
          return null;
        }

        throw new Error(`Refresh failed with status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.accessToken) {
        console.error("❌ No access token in refresh response");
        logout();
        return null;
      }

      console.log("✅ New access token received");
      localStorage.setItem("accessToken", data.accessToken);
      return data.accessToken;
    } catch (err) {
      console.error("❌ Network error during token refresh:", err);

      // Only logout on network errors if we don't have a valid token
      const currentToken = localStorage.getItem("accessToken");
      if (!currentToken) {
        logout();
      }

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
      } else {
        // Refresh failed, redirect to login
        console.log("Token refresh failed, redirecting to login");
        logout();
        throw new Error("Authentication failed");
      }
    }

    return response;
  }

  async function logout() {
    try {
      console.log("🔄 Starting logout process...");

      // Call logout endpoint to clear refresh token
      const response = await fetch("/logout", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        console.log("✅ Logout API call successful");
      } else {
        console.log("⚠️ Logout API returned status:", response.status);
      }
    } catch (error) {
      console.error("❌ Logout API call failed:", error);
    } finally {
      // Always clear local storage and redirect
      console.log("🔄 Clearing local storage...");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("userRole");
      localStorage.removeItem("userId");
      localStorage.removeItem("user");

      console.log("🔄 Redirecting to login page...");
      window.location.href = "/login.html";
    }
  }

  // ==================== DASHBOARD FUNCTIONS ====================

  // Temporary debug function
  async function debugTotalBooks() {
    console.log("🔍 DEBUG: Testing total-books API directly...");

    try {
      const response = await makeAuthenticatedRequest(
        "/api/librarian/dashboard/total-books",
      );
      const data = await response.json();
      console.log("🔍 DIRECT API RESPONSE:", data);
      console.log("🔍 Total books value:", data.total);

      // Also test the books endpoint
      const booksResponse = await makeAuthenticatedRequest(
        "/api/librarian/books",
      );
      const booksData = await booksResponse.json();
      console.log("🔍 ALL BOOKS RESPONSE:", booksData);
      console.log("🔍 Actual books count:", booksData.length);

      return data.total;
    } catch (error) {
      console.error("🔍 DEBUG ERROR:", error);
      return 0;
    }
  }

  // Call this temporarily
  debugTotalBooks();

  async function fetchTotalBooks() {
    try {
      console.log("🔍 fetchTotalBooks called");
      const response = await makeAuthenticatedRequest(
        "/api/librarian/dashboard/total-books",
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch total books: ${response.status}`);
      }

      const data = await response.json();
      console.log("🔍 fetchTotalBooks RESPONSE:", data);

      // SIMPLE - just return data.total
      return data.total;
    } catch (error) {
      console.error("Error fetching total books:", error);
      return 0;
    }
  }
  async function fetchBooksIssued() {
    try {
      const response = await makeAuthenticatedRequest(
        "/api/librarian/dashboard/issued-books",
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch books issued: ${response.status}`);
      }

      const data = await response.json();
      console.log("=== BOOKS ISSUED API RESPONSE ===");
      console.log("Complete response:", data);
      console.log("Type:", typeof data);
      console.log("Keys:", Object.keys(data));
      console.log("All properties:", Object.getOwnPropertyNames(data));
      console.log("JSON stringified:", JSON.stringify(data));
      console.log("=== END BOOKS ISSUED ===");

      // Try to extract the value
      let extractedValue = 0;
      if (typeof data === "number") {
        extractedValue = data;
      } else if (typeof data === "object" && data !== null) {
        // Try all possible property names
        extractedValue =
          data.issuedBooks ||
          data.booksIssued ||
          data.issued ||
          data.count ||
          data.total ||
          data.value ||
          data.issuedCount ||
          data.issuedTotal ||
          0;
      }

      console.log("Final extracted value:", extractedValue);
      return extractedValue;
    } catch (error) {
      console.error("Error fetching books issued:", error);
      return 0;
    }
  }

  async function fetchOverdueBooks() {
    try {
      const response = await makeAuthenticatedRequest(
        "/api/librarian/dashboard/overdue-books",
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch overdue books: ${response.status}`);
      }

      const data = await response.json();
      console.log("Overdue books API response:", data);
      console.log("Overdue books object keys:", Object.keys(data));

      // Handle different response formats
      if (typeof data === "number") {
        return data;
      } else if (typeof data === "object") {
        // Try to find the correct property
        const value =
          data.overdueBooks ||
          data.overdue ||
          data.count ||
          data.total ||
          data.value ||
          0;
        console.log("Extracted overdue books value:", value);
        return value;
      } else {
        return 0;
      }
    } catch (error) {
      console.error("Error fetching overdue books:", error);
      return 0;
    }
  }

  async function fetchPendingRequests() {
    try {
      const response = await makeAuthenticatedRequest(
        "/api/librarian/dashboard/pending-requests",
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch pending requests: ${response.status}`);
      }

      const data = await response.json();

      // Extract using the correct property name
      if (typeof data === "object" && data !== null) {
        return data.pending || 0;
      }
      return 0;
    } catch (error) {
      console.error("Error fetching pending requests:", error);
      return 0;
    }
  }

  async function fetchFinesCollected() {
    try {
      const response = await makeAuthenticatedRequest(
        "/api/librarian/dashboard/fines-collected",
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch fines collected: ${response.status}`);
      }

      const data = await response.json();

      // Extract using the correct property name
      if (typeof data === "object" && data !== null) {
        return data.collected || 0;
      }
      return 0;
    } catch (error) {
      console.error("Error fetching fines collected:", error);
      return 0;
    }
  }

  async function fetchActiveUsers() {
    try {
      const response = await makeAuthenticatedRequest(
        "/api/librarian/dashboard/active-users",
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch active users: ${response.status}`);
      }

      const data = await response.json();

      // Extract using the correct property name
      if (typeof data === "object" && data !== null) {
        return data.activeUsers || 0;
      }
      return 0;
    } catch (error) {
      console.error("Error fetching active users:", error);
      return 0;
    }
  }

  async function loadDashboardData() {
    console.log("🔄 ========== LOAD DASHBOARD DATA START ==========");

    try {
      // Test each endpoint individually first for debugging
      console.log("🔍 Testing total-books endpoint directly...");
      const totalBooksResponse = await makeAuthenticatedRequest(
        "/api/librarian/dashboard/total-books",
      );
      const totalBooksData = await totalBooksResponse.json();
      console.log("📊 TOTAL BOOKS RAW API RESPONSE:", totalBooksData);
      console.log("📊 Total books value:", totalBooksData.total);

      console.log("🔍 Testing books endpoint...");
      const booksResponse = await makeAuthenticatedRequest(
        "/api/librarian/books",
      );
      const booksData = await booksResponse.json();
      console.log("📚 ALL BOOKS RAW API RESPONSE:", booksData);
      console.log(
        "📚 Actual books count from books endpoint:",
        booksData.length,
      );

      // Fetch all metrics in parallel
      console.log("🔄 Fetching all dashboard metrics in parallel...");
      const [
        totalBooks,
        booksIssued,
        overdueBooks,
        pendingRequests,
        finesCollected,
        activeUsers,
      ] = await Promise.all([
        fetchTotalBooks(),
        fetchBooksIssued(),
        fetchOverdueBooks(),
        fetchPendingRequests(),
        fetchFinesCollected(),
        fetchActiveUsers(),
      ]);

      console.log("📊 FINAL DASHBOARD METRICS:", {
        totalBooks,
        booksIssued,
        overdueBooks,
        pendingRequests,
        finesCollected,
        activeUsers,
      });

      // Update the UI
      console.log("🔄 Updating UI elements...");
      const totalBooksElement = document.getElementById("totalBooksValue");
      const booksIssuedElement = document.getElementById("booksIssuedValue");
      const overdueBooksElement = document.getElementById("overdueBooksValue");
      const pendingRequestsElement = document.getElementById(
        "pendingRequestsValue",
      );
      const finesCollectedElement = document.getElementById(
        "finesCollectedValue",
      );
      const activeUsersElement = document.getElementById("activeUsersValue");

      if (totalBooksElement) {
        totalBooksElement.textContent = totalBooks.toLocaleString();
        console.log(
          "✅ Updated totalBooks element:",
          totalBooksElement.textContent,
        );
      }
      if (booksIssuedElement) {
        booksIssuedElement.textContent = booksIssued.toLocaleString();
        console.log(
          "✅ Updated booksIssued element:",
          booksIssuedElement.textContent,
        );
      }
      if (overdueBooksElement) {
        overdueBooksElement.textContent = overdueBooks.toLocaleString();
        console.log(
          "✅ Updated overdueBooks element:",
          overdueBooksElement.textContent,
        );
      }
      if (pendingRequestsElement) {
        pendingRequestsElement.textContent = pendingRequests.toLocaleString();
        console.log(
          "✅ Updated pendingRequests element:",
          pendingRequestsElement.textContent,
        );
      }
      if (finesCollectedElement) {
        finesCollectedElement.textContent = `₹${finesCollected.toLocaleString()}`;
        console.log(
          "✅ Updated finesCollected element:",
          finesCollectedElement.textContent,
        );
      }
      if (activeUsersElement) {
        activeUsersElement.textContent = activeUsers.toLocaleString();
        console.log(
          "✅ Updated activeUsers element:",
          activeUsersElement.textContent,
        );
      }

      console.log("✅ Dashboard data loaded successfully!");
    } catch (error) {
      console.error("❌ Error loading dashboard data:", error);

      // Show error in UI
      const totalBooksElement = document.getElementById("totalBooksValue");
      if (totalBooksElement) {
        totalBooksElement.textContent = "Error";
        totalBooksElement.style.color = "red";
      }
    }

    console.log("🔄 ========== LOAD DASHBOARD DATA END ==========");
  }
  // ==================== BOOK MANAGEMENT FUNCTIONS ====================
  async function loadManageBooks() {
    if (isSearchingBooks) {
      return; // Don't load all books if we're currently searching
    }

    try {
      const bookContainer = document.querySelector("#manageBooks .book-list");
      console.log("🔄 Book container found:", !!bookContainer);

      if (bookContainer) {
        bookContainer.innerHTML = '<div class="loading">Loading books...</div>';
      }

      console.log("🔄 Making API request to /api/librarian/books");
      const response = await makeAuthenticatedRequest("/api/librarian/books");

      console.log("🔄 Response status:", response.status);

      if (!response.ok) {
        let errorMessage = `Failed to fetch books: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = `${errorMessage} - ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const books = await response.json();
      console.log("✅ Books received from API:", books.length);

      if (books.length === 0) {
        console.log("📚 No books found in the system");
      }

      displayManageBooks(books);
    } catch (error) {
      console.error("❌ Error loading books:", error);
      const bookContainer = document.querySelector("#manageBooks .book-list");
      if (bookContainer) {
        bookContainer.innerHTML = `
        <div class="error-message">
          <p>Error loading books: ${error.message}</p>
          <button onclick="loadManageBooks()" class="retry-btn">Retry</button>
        </div>
      `;
      }
    }

    console.log("🔄 ========== LOAD MANAGE BOOKS END ==========");
  }
  async function searchManageBooks(searchTerm) {
    try {
      const bookContainer = document.querySelector("#manageBooks .book-list");

      if (!searchTerm.trim()) {
        isSearchingBooks = false;
        loadManageBooks();
        return;
      }

      isSearchingBooks = true; // Set searching flag

      if (bookContainer) {
        bookContainer.innerHTML =
          '<div class="loading">Searching books...</div>';
      }

      const response = await makeAuthenticatedRequest(
        `/api/librarian/books?search=${encodeURIComponent(searchTerm)}`,
      );

      if (!response.ok) {
        throw new Error("Failed to search books");
      }

      const books = await response.json();
      displayManageBooks(books);
      isSearchingBooks = false; // Reset flag after display
    } catch (error) {
      console.error("Error searching books:", error);
      isSearchingBooks = false;
      const bookContainer = document.querySelector("#manageBooks .book-list");
      if (bookContainer) {
        bookContainer.innerHTML =
          '<p class="error">Error searching books. Please try again.</p>';
      }
    }
  }
  function displayManageBooks(books) {
    console.log("🔄 Frontend: Starting displayManageBooks");

    const bookContainer = document.querySelector("#manageBooks .book-list");
    if (!bookContainer) return;

    if (!books || books.length === 0) {
      bookContainer.innerHTML = '<p class="no-books">No books found.</p>';
      return;
    }

    bookContainer.innerHTML = books
      .map((book, index) => {
        return `
<div class="book-item ${book.status === "issued" ? "issued" : "available"}">
  <div class="wrapper">
    <span>📖</span>
    <div>
      <strong>${book.bookName || "Untitled Book"}</strong>
      <p>${book.authorName || "Unknown Author"}</p>
      <p>ISBN: ${book.isbn || "N/A"}</p>
      <p class="status ${book.status}">Status: ${book.status.toUpperCase()}</p>
    </div>
  </div>
  <div class="actions">
    ${
      book.status === "available"
        ? `<button type="button" class="issueBook" data-book-id="${book.isbn}">Issue Book</button>`
        : `<button class="return-book" data-book-id="${book.isbn}">Return Book</button>`
    }
    <button class="remove" data-book-id="${book.isbn}">Remove</button>
    <button class="edit" data-book-id="${book.isbn}">Edit</button>
  </div>
</div>
`;
      })
      .join("");

    // ✅ FIX: Call the correct function
    initializeAllBookEvents();
  }

  // ✅ FIX: Simplified book events function
  function initializeAllBookEvents() {
    console.log("🔄 Initializing all book events...");

    // Remove and re-add event listeners to prevent duplicates
    document
      .querySelectorAll(".issueBook, .return-book, .edit, .remove")
      .forEach((button) => {
        button.replaceWith(button.cloneNode(true));
      });

    // ✅ FIX: Issue Book buttons - SIMPLE and RELIABLE
    document.querySelectorAll(".issueBook").forEach((button) => {
      button.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        const bookId = this.getAttribute("data-book-id");
        console.log("📚 Issue button clicked for book:", bookId);

        // Store book ID in multiple ways for reliability
        const issueBooksModal = document.querySelector("#issueBooksModal");
        if (issueBooksModal) {
          issueBooksModal.setAttribute("data-current-book-id", bookId);
          window.currentIssueBookId = bookId;

          console.log("✅ Book ID stored:", bookId);

          // Clear previous user ID and focus
          const userIDInput = document.getElementById("userID");
          if (userIDInput) {
            userIDInput.value = "";
            userIDInput.focus();
          }

          // Show modal
          issueBooksModal.style.display = "flex";
          if (overlay) overlay.style.display = "block";
        } else {
          console.error("❌ Issue modal not found");
        }
      });
    });

    // Return buttons
    document.querySelectorAll(".return-book").forEach((button) => {
      button.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        const bookId = this.getAttribute("data-book-id");
        const bookName =
          this.closest(".book-item").querySelector("strong").textContent;

        if (confirm(`Are you sure you want to return "${bookName}"?`)) {
          returnBook(bookId).catch((error) => {
            console.error("Failed to return book:", error);
          });
        }
      });
    });

    // Edit buttons
    document.querySelectorAll(".edit").forEach((button) => {
      button.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        const bookId = this.getAttribute("data-book-id");
        console.log("Edit book:", bookId);

        const editBooksModal = document.querySelector("#editBooksModal");
        if (editBooksModal) {
          editBooksModal.style.display = "flex";
          if (overlay) overlay.style.display = "block";

          loadBookDetails(bookId).catch((error) => {
            console.error("Failed to load book details:", error);
          });
        }
      });
    });

    // Remove buttons
    document.querySelectorAll(".remove").forEach((button) => {
      button.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        const bookId = this.getAttribute("data-book-id");
        const bookName =
          this.closest(".book-item").querySelector("strong").textContent;

        if (confirm(`Are you sure you want to remove "${bookName}"?`)) {
          removeBook(bookId).catch((error) => {
            console.error("Failed to remove book:", error);
          });
        }
      });
    });

    console.log("✅ Book events initialized");
  }

  //Issue Book
  async function issueBook(issueData) {
    console.log("🚀 ========== ISSUE BOOK FUNCTION START ==========");
    console.log("📥 Issue data received:", issueData);

    // ✅ Get the submit button and disable it
    const submitBtn = document.querySelector(
      '#issueBooksModal button[type="submit"]',
    );
    const originalText = submitBtn ? submitBtn.textContent : "Issue Book";

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Issuing...";
      submitBtn.style.opacity = "0.6";
    }

    try {
      const { userId, bookId } = issueData;

      // ✅ STEP 1: Validate input
      if (!userId || !bookId) {
        throw new Error("User ID and Book ID are required");
      }

      console.log("🌐 Making API call to direct issue endpoint...");

      // ✅ STEP 2: Make API request to direct issue endpoint
      const response = await makeAuthenticatedRequest(
        "/api/librarian/issues/issue",
        {
          method: "POST",
          body: JSON.stringify({
            userId: userId,
            bookId: bookId,
          }),
        },
      );

      console.log("📡 API Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Issue API error:", errorText);

        let errorMessage = "Failed to issue book";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log("✅ Book issued successfully:", result);

      // ✅ STEP 3: Close modal
      const issueBooksModal = document.querySelector("#issueBooksModal");
      if (issueBooksModal) {
        issueBooksModal.style.display = "none";
        issueBooksModal.removeAttribute("data-current-book-id");
      }
      if (overlay) overlay.style.display = "none";

      // ✅ STEP 4: Clear form
      const userIDInput = document.getElementById("userID");
      if (userIDInput) {
        userIDInput.value = "";
      }

      // ✅ STEP 5: Reset global variable
      window.currentIssueBookId = null;

      // ✅ STEP 6: Reload data
      await loadManageBooks(); // Reload books to show updated status
      await loadIssuedBooks(); // Reload issued books
      await loadDashboardData(); // Update dashboard counts

      // ✅ STEP 7: Show success message
      let successMessage = "✅ Book issued successfully!\n";
      successMessage += `📚 "${
        result.bookDetails?.bookName || "Book"
      }" issued to ${result.userDetails?.userName || "user"}.\n`;
      successMessage += `📅 Due Date: ${
        result.issuedBook?.dueDate || "15 days from now"
      }\n`;

      if (result.emailInitiated) {
        successMessage += "📧 Notification email sent to user.";
      }

      alert(successMessage);

      return result;
    } catch (error) {
      console.error("❌ Error issuing book:", error);

      let errorMessage = "Failed to issue book";
      if (error.message.includes("User with ID")) {
        errorMessage = "User not found. Please check the User ID.";
      } else if (error.message.includes("Book with ID")) {
        errorMessage = "Book not found. Please check the Book ID.";
      } else if (error.message.includes("already has 3 books")) {
        errorMessage = "User has reached the maximum limit of 3 books.";
      } else if (error.message.includes("already issued")) {
        errorMessage = "This book is already issued to another user.";
      } else if (error.message.includes("already has this book")) {
        errorMessage = "User already has this book issued.";
      } else if (error.message.includes("not available")) {
        errorMessage = "Book is not available for issue.";
      } else {
        errorMessage = error.message;
      }

      alert(`❌ ${errorMessage}`);
      throw error;
    } finally {
      // ✅ STEP 8: ALWAYS re-enable the button (whether success or error)
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        submitBtn.style.opacity = "1";
      }
      console.log("🚀 ========== ISSUE BOOK FUNCTION END ==========");
    }
  }
  //To edit a book
  async function editBook(bookId, bookData) {
    try {
      const response = await makeAuthenticatedRequest(
        `/api/librarian/books/${bookId}`,
        {
          method: "PUT",
          body: JSON.stringify(bookData),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to update book: ${response.status}`);
      }

      const result = await response.json();
      console.log("Book updated successfully:", result);

      // Reload the page after successful update
      window.location.reload();

      return result;
    } catch (error) {
      console.error("Error updating book:", error);
      alert("Error updating book. Please try again.");
      throw error;
    }
  }

  async function returnBook(bookId) {
    console.log("🔄 ========== RETURN BOOK FROM MANAGE BOOKS START ==========");
    console.log("📥 Book ISBN received:", bookId);

    // ✅ Check if already processing a return
    if (isProcessingReturn) {
      alert("Please wait, another book is being returned...");
      return;
    }

    // Get the return button
    const returnButton = document.querySelector(
      `.return-book[data-book-id="${bookId}"]`,
    );
    if (!returnButton) {
      console.error("❌ Return button not found for book:", bookId);
      return;
    }

    const originalText = returnButton.textContent;

    // ✅ Set global flag and disable button
    isProcessingReturn = true;
    returnButton.disabled = true;
    returnButton.textContent = "Returning...";
    returnButton.style.opacity = "0.6";

    try {
      console.log("🔍 Searching for approved book record...");
      const approvedResponse = await makeAuthenticatedRequest(
        "/api/librarian/issues/issue",
      );

      if (!approvedResponse.ok) {
        throw new Error(
          `Failed to fetch issued books: ${approvedResponse.status}`,
        );
      }

      const approvedBooks = await approvedResponse.json();
      console.log("📋 All approved books:", approvedBooks);

      // ✅ Find the specific issue record for this book
      const approvedRecord = approvedBooks.find(
        (book) =>
          book.bookId === bookId &&
          (book.status === "issued" || book.status === "overdue"),
      );

      if (!approvedRecord) {
        throw new Error(
          "No active issue record found for this book. It may already be returned.",
        );
      }

      console.log("✅ Found approved record:", {
        _id: approvedRecord._id,
        id: approvedRecord.id,
        bookId: approvedRecord.bookId,
        status: approvedRecord.status,
      });

      // ✅ STEP 2: Single confirmation
      const bookName = approvedRecord.bookTitle || "this book";
      if (!confirm(`Are you sure you want to return "${bookName}"?`)) {
        return;
      }

      // ✅ STEP 3: FIX - Use _id instead of id
      const issueId = approvedRecord._id || approvedRecord.id;
      if (!issueId) {
        throw new Error("No valid issue ID found in the record");
      }

      console.log("🌐 Calling return endpoint with ApprovedBook ID:", issueId);
      const response = await makeAuthenticatedRequest(
        `/api/librarian/issues/${issueId}/return`,
        {
          method: "PUT",
        },
      );

      console.log("📡 API Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Return API error:", errorText);

        let errorMessage = "Failed to return book";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log("✅ Book returned successfully:", result);

      // ✅ STEP 4: Reload books and show success
      await loadManageBooks();

      // ✅ STEP 5: Single success message
      let successMessage = "✅ Book returned successfully!\n";
      successMessage += `📚 "${
        result.returnedBook?.bookName || bookName
      }" is now available.\n`;

      if (result.emailSent) {
        successMessage += "📧 Confirmation email sent to user.";
      }

      alert(successMessage);
      return result;
    } catch (error) {
      console.error("❌ Error returning book:", error);
      alert("❌ Error returning book: " + error.message);
      throw error;
    } finally {
      // ✅ IMPORTANT: Reset global flag and re-enable button
      isProcessingReturn = false;
      if (returnButton) {
        returnButton.disabled = false;
        returnButton.textContent = originalText;
        returnButton.style.opacity = "1";
      }
      console.log("🔄 ========== RETURN BOOK FROM MANAGE BOOKS END ==========");
    }
  }
  // REPLACE ONLY the loadBookDetails function with this:
  async function loadBookDetails(bookId) {
    try {
      console.log("Loading book details for:", bookId);

      const response = await makeAuthenticatedRequest("/api/librarian/books");
      if (!response.ok) throw new Error("Failed to fetch books");

      const books = await response.json();
      console.log("All books:", books);

      const book = books.find((b) => b.isbn === bookId || b.bookID === bookId);

      if (!book) {
        throw new Error(`Book with ID ${bookId} not found`);
      }

      console.log("Found book:", book);

      // Fill the form with book data - USING CORRECT IDs FROM YOUR HTML
      document.getElementById("editBookTitle").value =
        book.bookName || book.title || "";
      document.getElementById("editBookAuthor").value =
        book.authorName || book.author || "";
      document.getElementById("editBookStudentId").value =
        book.isbn || book.bookID || "";

      // Store original ISBN as data attribute
      document
        .getElementById("editBookStudentId")
        .setAttribute("data-original-id", book.isbn || book.bookID);

      // Set department - USING CORRECT ID FROM YOUR HTML
      const deptSelect = document.getElementById("editBookStudentDept");
      if (deptSelect && book.department) {
        deptSelect.value = book.department;
        console.log("Set department to:", book.department);
      } else {
        console.log("No department found in book data");
      }

      return book;
    } catch (error) {
      console.error("Error loading book details:", error);
      alert(`Error loading book details: ${error.message}`);
      throw error;
    }
  }
  async function removeBook(bookId) {
    try {
      const response = await makeAuthenticatedRequest(
        `/api/librarian/books/${bookId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Delete error:", errorText);

        // Parse the error message
        let errorMessage = "Failed to delete book";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log("Book deleted successfully:", result);

      // Reload the books list after successful deletion
      loadManageBooks();

      alert("Book deleted successfully!");
      return result;
    } catch (error) {
      console.error("Error deleting book:", error);

      // Show specific error message
      if (error.message.includes("Cannot delete issued book")) {
        alert(
          "❌ Cannot delete issued book. Please return the book first, then delete it.",
        );
      } else {
        alert("Error deleting book: " + error.message);
      }

      throw error;
    }
  }

  async function returnBook(bookId) {
    console.log("🔄 ========== RETURN BOOK FROM MANAGE BOOKS START ==========");
    console.log("📥 Book ISBN received:", bookId);

    // ✅ Check if already processing a return
    if (isProcessingReturn) {
      alert("Please wait, another book is being returned...");
      return;
    }

    // Get the return button
    const returnButton = document.querySelector(
      `.return-book[data-book-id="${bookId}"]`,
    );
    if (!returnButton) {
      console.error("❌ Return button not found for book:", bookId);
      return;
    }

    const originalText = returnButton.textContent;

    // ✅ Set global flag and disable button
    isProcessingReturn = true;
    returnButton.disabled = true;
    returnButton.textContent = "Returning...";
    returnButton.style.opacity = "0.6";

    try {
      // ✅ STEP 1: Find the active issue record for this book
      console.log("🔍 Searching for issued book record...");
      const approvedResponse = await makeAuthenticatedRequest(
        "/api/librarian/issued-books",
      );

      if (!approvedResponse.ok) {
        throw new Error(
          `Failed to fetch issued books: ${approvedResponse.status}`,
        );
      }

      const issuedBooks = await approvedResponse.json();
      console.log("📋 All issued books:", issuedBooks);

      // ✅ Find the specific issue record for this book - FIXED SEARCH
      const issueRecord = issuedBooks.find((book) => {
        console.log(`🔍 Comparing: ${book.bookId} === ${bookId}`, {
          bookId: book.bookId,
          searchId: bookId,
          status: book.status,
          match:
            book.bookId === bookId &&
            (book.status === "issued" || book.status === "overdue"),
        });
        return (
          book.bookId === bookId &&
          (book.status === "issued" || book.status === "overdue")
        );
      });

      if (!issueRecord) {
        console.error(
          "❌ No active issue record found. Available books:",
          issuedBooks.map((b) => ({
            bookId: b.bookId,
            status: b.status,
            id: b.id,
          })),
        );
        throw new Error(
          "No active issue record found for this book. It may already be returned.",
        );
      }

      console.log("✅ Found issue record:", {
        id: issueRecord.id,
        bookId: issueRecord.bookId,
        status: issueRecord.status,
        bookTitle: issueRecord.bookTitle,
      });

      // ✅ STEP 2: Confirmation
      const bookName = issueRecord.bookTitle || "this book";
      if (!confirm(`Are you sure you want to return "${bookName}"?`)) {
        return;
      }

      // ✅ STEP 3: Verify we have a valid ID before making the API call
      if (!issueRecord.id) {
        throw new Error("No valid issue ID found. Cannot process return.");
      }

      console.log("🌐 Calling return endpoint with Issue ID:", issueRecord.id);
      const response = await makeAuthenticatedRequest(
        `/api/librarian/issues/${issueRecord.id}/return`,
        {
          method: "PUT",
        },
      );

      console.log("📡 API Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Return API error:", errorText);

        let errorMessage = "Failed to return book";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log("✅ Book returned successfully:", result);

      // ✅ STEP 4: Reload books and show success
      await loadManageBooks();

      // ✅ STEP 5: Single success message
      let successMessage = "✅ Book returned successfully!\n";
      successMessage += `📚 "${
        result.returnedBook?.bookName || bookName
      }" is now available.\n`;

      if (result.emailSent) {
        successMessage += "📧 Confirmation email sent to user.";
      }

      alert(successMessage);
      return result;
    } catch (error) {
      console.error("❌ Error returning book:", error);
      alert("❌ Error returning book: " + error.message);
      throw error;
    } finally {
      // ✅ IMPORTANT: Reset global flag and re-enable button
      isProcessingReturn = false;
      if (returnButton) {
        returnButton.disabled = false;
        returnButton.textContent = originalText;
        returnButton.style.opacity = "1";
      }
      console.log("🔄 ========== RETURN BOOK FROM MANAGE BOOKS END ==========");
    }
  }
  function initializeModalEvents() {
    // Add the event listener
    document.addEventListener("click", handleBookActions);
  }

  // function handleBookActions(e) {
  //   // Return button click
  //   if (e.target.classList.contains("return-book")) {
  //     const bookId = e.target.dataset.bookId;
  //     const bookName = e.target
  //       .closest(".book-item")
  //       .querySelector("strong").textContent;

  //     // ✅ Check if already processing
  //     if (e.target.disabled || isProcessingReturn) {
  //       console.log("Return already in progress for:", bookName);
  //       return;
  //     }

  //     if (confirm(`Are you sure you want to return the book "${bookName}"?`)) {
  //       console.log("Return book:", bookId);
  //       returnBook(bookId).catch((error) => {
  //         console.error("Failed to return book:", error);
  //       });
  //     }
  //   }

  //   // Edit button click
  //   if (e.target.classList.contains("edit")) {
  //     const bookId = e.target.dataset.bookId;
  //     console.log("Edit book:", bookId);
  //     const editBooksModal = document.querySelector("#editBooksModal");
  //     editBooksModal.style.display = "flex";

  //     // Load book details into the form
  //     loadBookDetails(bookId).catch((error) => {
  //       console.error("Failed to load book details:", error);
  //     });
  //   }

  //   if (e.target.classList.contains("issueBook")) {
  //     const bookId = e.target.dataset.bookId;
  //     console.log("📚 Issue button clicked for book:", bookId);

  //     const issueBooksModal = document.querySelector("#issueBooksModal");
  //     if (!issueBooksModal) {
  //       console.error("❌ Issue modal not found");
  //       return;
  //     }

  //     // ✅ FIX: Store book ID in a way that persists
  //     // Method 1: Use a data attribute (preferred)
  //     issueBooksModal.setAttribute("data-current-book-id", bookId);

  //     // Method 2: Also store in a global variable as backup
  //     window.currentIssueBookId = bookId;

  //     console.log("✅ Book ID stored:", bookId);
  //     console.log(
  //       "🔍 Modal data attribute:",
  //       issueBooksModal.getAttribute("data-current-book-id")
  //     );

  //     // Clear previous user ID and focus
  //     const userIDInput = document.getElementById("userID");
  //     if (userIDInput) {
  //       userIDInput.value = "";
  //       userIDInput.focus();
  //     }

  //     // Show modal
  //     issueBooksModal.style.display = "flex";
  //     if (overlay) overlay.style.display = "block";
  //   }

  //   // Remove button functionality
  //   if (e.target.classList.contains("remove")) {
  //     const bookId = e.target.dataset.bookId;
  //     const bookName = e.target
  //       .closest(".book-item")
  //       .querySelector("strong").textContent;

  //     if (confirm(`Are you sure you want to remove the book "${bookName}"?`)) {
  //       console.log("Remove book:", bookId);
  //       removeBook(bookId).catch((error) => {
  //         console.error("Failed to remove book:", error);
  //         // Show proper error message from backend
  //         if (error.message.includes("Cannot delete issued book")) {
  //           alert("Cannot delete issued book. Please process return first.");
  //         }
  //       });
  //     }
  //   }
  // }
  // ==================== USER MANAGEMENT FUNCTIONS ====================

  // Load users
  async function loadManageUsers() {
    if (isSearchingUsers) {
      return;
    }
    try {
      const userTableBody = document.getElementById("userTableBody");
      userTableBody.innerHTML =
        '<tr><td colspan="6" class="loading">Loading users...</td></tr>';

      const response = await makeAuthenticatedRequest("/api/librarian/users");

      if (!response.ok) throw new Error("Failed to fetch users");

      const users = await response.json();
      displayManageUsers(users);
    } catch (error) {
      console.error("Error loading users:", error);
      document.getElementById("userTableBody").innerHTML =
        '<tr><td colspan="6" class="error">Error loading users</td></tr>';
    }
  }

  // Display users
  function displayManageUsers(users) {
    const userTableBody = document.getElementById("userTableBody");

    if (!users || users.length === 0) {
      userTableBody.innerHTML =
        '<tr><td colspan="6" class="no-users">No users found</td></tr>';
      return;
    }

    userTableBody.innerHTML = users
      .map((user) => {
        const isLibrarian = user.roles?.Librarian === 5150;
        const deleteButton = isLibrarian
          ? `<button class="delete-user disabled" disabled>Delete</button>`
          : `<button class="delete-user" data-user-id="${user.id}">Delete</button>`;

        return `
      <tr>
        <td>${user.name || "N/A"}</td>
        <td>${user.email || "N/A"}</td>
        <td>${user.id || "N/A"}</td>
        <td>${user.course || "N/A"}</td>
        <td>${user.department || "N/A"}</td>
        <td>
          <button class="edit-user" data-user-id="${user.id}">Edit</button>
          ${deleteButton}
        </td>
      </tr>
    `;
      })
      .join("");

    initializeUserEvents();
  }

  // UPDATE the displayManageUsers function:
  // FIX the displayManageUsers function - replace the entire function:
  function displayManageUsers(users) {
    const userTableBody = document.getElementById("userTableBody");
    if (!userTableBody) return;

    if (!users || users.length === 0) {
      userTableBody.innerHTML =
        '<tr><td colspan="6" class="no-users">No users found.</td></tr>';
      return;
    }

    userTableBody.innerHTML = users
      .map((user) => {
        // Check if user is librarian
        const isLibrarian =
          user.roles?.Librarian === 5150 || user.role === "librarian";
        const deleteButton = isLibrarian
          ? `<button class="delete-user disabled" data-user-id="${user.id}" disabled title="Cannot delete librarian accounts">Delete</button>`
          : `<button class="delete-user" data-user-id="${user.id}">Delete</button>`;

        return `
      <tr>
        <td>${user.name || "N/A"}</td>
        <td>${user.email || "N/A"}</td>
        <td>${user.id || "N/A"}</td>
        <td>${user.course || "N/A"}</td>
        <td>${user.department || "N/A"}</td>
        <td>
          <button class="edit-user" data-user-id="${user.id}">Edit</button>
          ${deleteButton}
        </td>
      </tr>
    `;
      })
      .join("");

    // Add event listeners for user actions
    initializeUserEvents();
  }

  //searching users
  async function searchUsers(searchTerm) {
    try {
      const userTableBody = document.getElementById("userTableBody");

      if (!searchTerm.trim()) {
        isSearchingUsers = false;
        loadManageUsers();
        return;
      }

      isSearchingUsers = true;

      if (userTableBody) {
        userTableBody.innerHTML =
          '<tr><td colspan="6" class="loading">Searching users...</td></tr>';
      }

      const response = await makeAuthenticatedRequest(
        `/api/librarian/users?search=${encodeURIComponent(searchTerm)}`,
      );

      if (!response.ok) {
        throw new Error("Failed to search users");
      }

      const users = await response.json();
      displayManageUsers(users);
      isSearchingUsers = false;
    } catch (error) {
      console.error("Error searching users:", error);
      isSearchingUsers = false;
      const userTableBody = document.getElementById("userTableBody");
      if (userTableBody) {
        userTableBody.innerHTML =
          '<tr><td colspan="6" class="error">Error searching users. Please try again.</td></tr>';
      }
    }
  }

  // ==================== ADD USER FUNCTIONALITY ====================

  async function addNewUser(userData) {
    try {
      console.log("Sending to /register:", userData);

      const response = await fetch("/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: userData.name,
          email: userData.email,
          id: userData.id,
          course: userData.course,
          department: userData.department,
          pwd: userData.password,
        }),
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        // Handle text responses for errors
        const errorText = await response.text();
        console.error("Error response:", errorText);

        let errorMessage = "Failed to add user";
        if (response.status === 409) {
          errorMessage = "User with this ID already exists";
        } else if (errorText.includes("Conflict")) {
          errorMessage = "User already exists";
        } else {
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.message || errorMessage;
          } catch (e) {
            // If not JSON, use the text as is
            errorMessage = errorText || errorMessage;
          }
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log("User added successfully:", result);

      // Close modal and reload users
      const addUserModal = document.querySelector("#addUserModal");
      addUserModal.style.display = "none";
      if (overlay) overlay.style.display = "none";

      // Reset form
      document.getElementById("addUserForm").reset();

      // Reload users list
      loadManageUsers();

      alert("User added successfully!");
      return result;
    } catch (error) {
      console.error("Error adding user:", error);
      alert(`Error: ${error.message}`);
      throw error;
    }
  }
  function initializeAddUserForm() {
    const addUserForm = document.getElementById("addUserForm");
    if (!addUserForm) return;

    // Remove all existing event listeners by replacing the form
    const newForm = addUserForm.cloneNode(true);
    addUserForm.parentNode.replaceChild(newForm, addUserForm);

    // Add fresh event listener to the new form
    document
      .getElementById("addUserForm")
      .addEventListener("submit", async function (e) {
        e.preventDefault();
        console.log("Form submitted - starting validation");

        // Get form values directly from the modal to avoid duplicate ID issues
        const modal = document.querySelector("#addUserModal");
        const formData = {
          name: modal.querySelector("#userName").value.trim(),
          email: modal.querySelector("#userEmail").value.trim(),
          id: modal.querySelector("#studentId").value.trim(),
          course: modal.querySelector("#studentCourse").value,
          department: modal.querySelector("#studentDept").value,
          password: modal.querySelector("#password").value,
        };

        console.log("Form data collected:", formData);

        // ✅ Enhanced validation with better error messages
        if (!formData.name) {
          alert("Please enter a Name");
          modal.querySelector("#userName").focus();
          return;
        }

        if (!formData.email) {
          alert("Please enter an Email");
          modal.querySelector("#userEmail").focus();
          return;
        }

        // Basic email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
          alert("Please enter a valid email address");
          modal.querySelector("#userEmail").focus();
          return;
        }

        if (!formData.id) {
          alert("Please enter a Student ID");
          modal.querySelector("#studentId").focus();
          return;
        }

        // ✅ REMOVED numeric validation for alphanumeric IDs
        // Just check if ID is not empty
        if (formData.id.length === 0) {
          alert("Please enter a valid Student ID");
          modal.querySelector("#studentId").focus();
          return;
        }

        // ✅ Optional: Add basic alphanumeric validation if needed
        // const idRegex = /^[a-zA-Z0-9]+$/;
        // if (!idRegex.test(formData.id)) {
        //   alert("Student ID can only contain letters and numbers");
        //   modal.querySelector("#studentId").focus();
        //   return;
        // }

        if (!formData.department || formData.department === "") {
          alert("Please select a Department");
          modal.querySelector("#studentDept").focus();
          return;
        }

        if (!formData.course || formData.course === "") {
          alert("Please select a Course");
          modal.querySelector("#studentCourse").focus();
          return;
        }

        if (!formData.password) {
          alert("Please enter a Password");
          modal.querySelector("#password").focus();
          return;
        }

        // If we passed validation, submit the form
        console.log("Validation passed, submitting...");

        // Disable submit button to prevent double submission
        const submitBtn = modal.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = "Adding User...";

        try {
          await addNewUser(formData);
        } catch (error) {
          console.error("Form submission error:", error);
        } finally {
          // Re-enable button
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      });
  }

  initializeAddUserForm();

  async function deleteUserWithIssuesCheck(userId, userName) {
    try {
      console.log("🔄 Checking user issues before deletion:", userId);

      // ✅ STEP 1: Check if user has any issued books
      const issuedBooksResponse = await makeAuthenticatedRequest(
        "/api/librarian/issued-books",
      );

      if (!issuedBooksResponse.ok) {
        throw new Error("Failed to check issued books");
      }

      const allIssuedBooks = await issuedBooksResponse.json();
      const userIssuedBooks = allIssuedBooks.filter(
        (book) =>
          book.userId === userId &&
          (book.status === "issued" || book.status === "overdue"),
      );

      console.log(
        `📚 User ${userId} has ${userIssuedBooks.length} issued books`,
      );

      if (userIssuedBooks.length > 0) {
        // ✅ STEP 2: Show confirmation with details
        const bookList = userIssuedBooks
          .map(
            (book) =>
              `• ${book.bookTitle || "Unknown Book"} (Due: ${book.dueDate})`,
          )
          .join("\n");

        const confirmMessage =
          `⚠️ User "${userName}" has ${userIssuedBooks.length} actively issued books:\n\n${bookList}\n\n` +
          `Are you sure you want to delete this user?\n\n` +
          `✅ ALL books will be automatically returned\n` +
          `✅ Any fines will be marked as paid\n` +
          `✅ User account will be permanently deleted`;

        if (!confirm(confirmMessage)) {
          console.log("❌ User cancelled deletion");
          return;
        }

        // ✅ STEP 3: Auto-return all issued books
        console.log("🔄 Auto-returning user's issued books...");

        for (const book of userIssuedBooks) {
          try {
            console.log(`📚 Returning book: ${book.bookTitle}`);

            const returnResponse = await makeAuthenticatedRequest(
              `/api/librarian/issues/${book._id}/return`,
              {
                method: "PUT",
              },
            );

            if (!returnResponse.ok) {
              console.error(`❌ Failed to return book ${book.bookTitle}`);
              continue; // Continue with other books
            }

            const returnResult = await returnResponse.json();
            console.log(`✅ Book returned: ${book.bookTitle}`, returnResult);
          } catch (bookError) {
            console.error(
              `❌ Error returning book ${book.bookTitle}:`,
              bookError,
            );
            // Continue with other books even if one fails
          }
        }

        // ✅ STEP 4: Mark any fines as paid
        console.log("🔄 Checking and clearing user fines...");
        try {
          const finesResponse = await makeAuthenticatedRequest(
            "/api/librarian/fines",
          );

          if (finesResponse.ok) {
            const allFines = await finesResponse.json();
            const userFines = allFines.filter(
              (fine) => fine.userId === userId && fine.status === "overdue",
            );

            for (const fine of userFines) {
              try {
                const paidResponse = await makeAuthenticatedRequest(
                  `/api/librarian/fines/${fine._id}/paid`,
                  {
                    method: "PUT",
                  },
                );

                if (paidResponse.ok) {
                  console.log(`✅ Fine marked as paid: ${fine.bookTitle}`);
                }
              } catch (fineError) {
                console.error(`❌ Error marking fine as paid:`, fineError);
              }
            }
          }
        } catch (finesError) {
          console.error("❌ Error processing fines:", finesError);
        }
      } else {
        // No issued books - simple confirmation
        if (!confirm(`Are you sure you want to delete user "${userName}"?`)) {
          return;
        }
      }

      // ✅ STEP 5: Delete the user
      console.log("🗑️ Deleting user account...");
      const deleteResponse = await makeAuthenticatedRequest(
        `/api/librarian/users/${userId}`,
        {
          method: "DELETE",
        },
      );

      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        throw new Error(`Failed to delete user: ${errorText}`);
      }

      const result = await deleteResponse.json();

      // ✅ STEP 6: Show appropriate success message
      let successMessage = `✅ User "${userName}" deleted successfully!`;

      if (userIssuedBooks.length > 0) {
        successMessage += `\n📚 ${userIssuedBooks.length} books were automatically returned.`;

        if (userIssuedBooks.some((book) => book.status === "overdue")) {
          successMessage += `\n💰 Any overdue fines were cleared.`;
        }
      }

      alert(successMessage);

      // ✅ STEP 7: Reload data
      loadManageUsers();

      // Also reload other sections that might be affected
      loadReturnsData();
      loadFinesData();
      loadDashboardData();

      return result;
    } catch (error) {
      console.error("❌ Error deleting user:", error);

      let errorMessage = "Failed to delete user";
      if (error.message.includes("issued books")) {
        errorMessage =
          "Cannot delete user with issued books. Please process returns first.";
      } else if (error.message.includes("librarian accounts")) {
        errorMessage = "Cannot delete librarian accounts.";
      } else {
        errorMessage = error.message;
      }

      alert(`❌ ${errorMessage}`);
      throw error;
    }
  }
  // ✅ ADD THIS FUNCTION to load user details for editing
  async function loadUserDetails(userId) {
    try {
      console.log("🔄 ========== LOAD USER DETAILS START ==========");
      console.log("📥 User ID received:", userId);
      console.log("📥 User ID type:", typeof userId);
      console.log("📥 User ID length:", userId.length);

      // ✅ DEBUG: Check if we can find the hidden field BEFORE API call
      const hiddenField = document.getElementById("editUserId");
      console.log("🔍 Hidden field element:", hiddenField);
      console.log(
        "🔍 Hidden field current value:",
        hiddenField ? hiddenField.value : "NOT FOUND",
      );
      console.log(
        "🔍 Hidden field HTML:",
        hiddenField ? hiddenField.outerHTML : "ELEMENT NOT FOUND",
      );

      // ✅ DEBUG: Check all form elements exist
      const formElements = {
        editStudentId: document.getElementById("editStudentId"),
        editUserName: document.getElementById("editUserName"),
        editUserEmail: document.getElementById("editUserEmail"),
        editStudentCourse: document.getElementById("editStudentCourse"),
        editStudentDept: document.getElementById("editStudentDept"),
        editUserRole: document.getElementById("editUserRole"),
      };

      console.log("🔍 Form elements check:");
      Object.keys(formElements).forEach((key) => {
        console.log(`  - ${key}:`, formElements[key] ? "FOUND" : "NOT FOUND");
      });

      console.log("🌐 Making API request to fetch users...");
      const response = await makeAuthenticatedRequest("/api/librarian/users");

      console.log("📡 API Response status:", response.status);
      console.log("📡 API Response ok:", response.ok);

      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }

      const users = await response.json();
      console.log("📋 All users fetched:", users.length);
      console.log(
        "📋 Users sample:",
        users.slice(0, 3).map((u) => ({ id: u.id, name: u.name })),
      );

      const user = users.find((u) => u.id === userId);
      console.log("🔍 User search result:", user);

      if (!user) {
        console.error("❌ User not found in API response");
        console.error(
          "🔍 Available user IDs:",
          users.map((u) => u.id),
        );
        throw new Error(`User with ID "${userId}" not found`);
      }

      console.log("✅ User details loaded:", {
        id: user.id,
        name: user.name,
        email: user.email,
        course: user.course,
        department: user.department,
        roles: user.roles,
      });

      // ✅ FIX: Update the hidden field with the actual user ID
      if (hiddenField) {
        console.log("🔄 Setting hidden field value to:", user.id);
        hiddenField.value = user.id;

        // ✅ Verify the value was set
        const verifyHiddenField = document.getElementById("editUserId");
        console.log(
          "✅ Hidden field after setting:",
          verifyHiddenField ? verifyHiddenField.value : "VERIFICATION FAILED",
        );
      } else {
        console.error("❌ Hidden field not found - cannot set value!");
      }

      // Fill the visible form fields
      console.log("🔄 Populating form fields...");
      if (formElements.editStudentId)
        formElements.editStudentId.value = user.id;
      if (formElements.editUserName)
        formElements.editUserName.value = user.name || "";
      if (formElements.editUserEmail)
        formElements.editUserEmail.value = user.email || "";
      if (formElements.editStudentCourse)
        formElements.editStudentCourse.value = user.course || "";
      if (formElements.editStudentDept)
        formElements.editStudentDept.value = user.department || "";

      // Set role based on user roles
      const roleSelect = document.getElementById("editUserRole");
      if (roleSelect) {
        let roleValue = "student";
        if (user.roles?.Librarian === 5150) {
          roleValue = "librarian";
        } else if (user.roles?.Admin === 1984) {
          roleValue = "admin";
        }
        roleSelect.value = roleValue;
        console.log("✅ Role set to:", roleValue);
      }

      // ✅ DEBUG: Verify all fields are set correctly
      console.log("🔍 Form fields after loading:", {
        hiddenField: document.getElementById("editUserId")?.value,
        studentId: document.getElementById("editStudentId")?.value,
        name: document.getElementById("editUserName")?.value,
        email: document.getElementById("editUserEmail")?.value,
        course: document.getElementById("editStudentCourse")?.value,
        department: document.getElementById("editStudentDept")?.value,
        role: document.getElementById("editUserRole")?.value,
      });

      console.log("✅ ========== LOAD USER DETAILS END ==========");
      return user;
    } catch (error) {
      console.error("❌ Error loading user details:", error);
      console.error("❌ Error stack:", error.stack);
      throw error;
    }
  }
  // ==================== ISSUED BOOKS FUNCTIONS ====================

  async function loadIssuedBooks() {
    try {
      console.log("🔄 Loading issued books...");

      const response = await makeAuthenticatedRequest(
        "/api/librarian/issued-books",
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch issued books: ${response.status}`);
      }

      const issuedBooks = await response.json();
      console.log("✅ Issued books received:", issuedBooks);

      // Calculate counts
      const totalIssued = issuedBooks.length;
      const dueToday = issuedBooks.filter((book) => {
        const dueDate = new Date(book.dueDate);
        const today = new Date();
        return (
          dueDate.toDateString() === today.toDateString() &&
          book.status === "issued"
        );
      }).length;

      const overdue = issuedBooks.filter(
        (book) => book.status === "overdue",
      ).length;

      // Update overview cards
      updateIssuedBooksOverview(totalIssued, dueToday, overdue);

      // Display issued books
      displayIssuedBooks(issuedBooks);
    } catch (error) {
      console.error("❌ Error loading issued books:", error);
      // Show error in UI
      document.querySelector("#issuedBooks .issued-grid").innerHTML =
        '<p class="error">Error loading issued books. Please try again.</p>';
    }
  }

  function updateIssuedBooksOverview(total, dueToday, overdue) {
    console.log("📊 Updating issued books overview:", {
      total,
      dueToday,
      overdue,
    });

    // Update the overview cards
    const overviewCards = document.querySelectorAll(
      "#issuedBooks .overview-card",
    );
    if (overviewCards.length >= 3) {
      overviewCards[0].querySelector("p").textContent = total;
      overviewCards[1].querySelector("p").textContent = dueToday;
      overviewCards[2].querySelector("p").textContent = overdue;
    }
  }

  async function displayIssuedBooks(books) {
    const issuedGrid = document.querySelector("#issuedBooks .issued-grid");
    if (!issuedGrid) return;

    if (!books || books.length === 0) {
      issuedGrid.innerHTML =
        '<p class="no-books">No books currently issued.</p>';
      return;
    }

    issuedGrid.innerHTML = books
      .map((book) => {
        // Determine status and styling
        let statusClass = "on-time";
        let statusText = "Active";

        if (book.status === "overdue") {
          statusClass = "overdue";
          statusText = "Overdue";
        } else {
          // Check if due today or soon
          const dueDate = new Date(book.dueDate);
          const today = new Date();
          const timeDiff = dueDate.getTime() - today.getTime();
          const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

          if (daysDiff <= 0) {
            statusClass = "overdue";
            statusText = "Overdue";
          } else if (daysDiff <= 2) {
            statusClass = "due-soon";
            statusText = "Due Soon";
          }
        }

        // Use the enriched data from the backend
        const bookTitle = book.bookTitle || book.bookName || "Unknown Book";
        const bookAuthor = book.bookAuthor || "Unknown Author";
        const userName = book.userName || `User ID: ${book.userId}`;

        return `
      <div class="issued-card ${statusClass}">
        <span>📖</span>
        <h3>${bookTitle}</h3>
        <p>${userName}</p>
        <p>Author: ${bookAuthor}</p>
        <p>Due: ${new Date(book.dueDate).toLocaleDateString()}</p>
        <p>Issued: ${new Date(book.issueDate).toLocaleDateString()}</p>
        <span class="status ${statusClass}">${statusText}</span>
        ${
          book.status === "overdue"
            ? `<button class="process-return" data-issue-id="${book.id}">Process Return</button>`
            : ""
        }
      </div>
    `;
      })
      .join("");

    // Add event listeners for process return buttons
    initializeIssuedBooksEvents();
  }

  async function processIssuedBookReturn(issueId) {
    try {
      if (!confirm("Are you sure you want to process this return?")) {
        return;
      }

      console.log("🌐 Processing issued book return for ID:", issueId);

      const response = await makeAuthenticatedRequest(
        `/api/librarian/issues/${issueId}/return`,
        {
          method: "PUT",
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Return API error:", errorText);
        throw new Error(`Failed to process return: ${response.status}`);
      }

      const result = await response.json();
      console.log("✅ Book return processed:", result);

      // Reload issued books
      loadIssuedBooks();

      alert(
        "✅ Book return processed successfully!" +
          (result.emailSent ? "\n📧 Confirmation email sent." : ""),
      );
    } catch (error) {
      console.error("❌ Error processing return:", error);
      alert("Error processing return: " + error.message);
    }
  }
  // ==================== REQUEST MANAGEMENT FUNCTIONS ====================

  async function loadPendingRequests() {
    try {
      console.log("🔄 Loading pending requests...");

      const response = await makeAuthenticatedRequest(
        "/api/librarian/requests/pending", // ✅ CORRECT ENDPOINT
      );

      console.log("📡 Response status:", response.status);
      console.log("📡 Response ok:", response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Server error response:", errorText);
        throw new Error(
          `Failed to fetch pending requests: ${response.status} - ${errorText}`,
        );
      }

      const requests = await response.json();
      console.log("✅ Pending requests received:", requests);
      console.log("📊 Number of requests:", requests.length);

      displayPendingRequests(requests);
    } catch (error) {
      console.error("❌ Error loading pending requests:", error);
      // Show error in UI
      const requestList = document.querySelector(".request-list");
      if (requestList) {
        requestList.innerHTML =
          '<p class="error">Error loading requests: ' + error.message + "</p>";
      }
    }
  }

  async function displayPendingRequests(requests) {
    console.log("🔄 ========== DISPLAY PENDING REQUESTS DEBUG ==========");
    console.log("📥 Requests received:", requests);
    console.log("📥 Number of requests:", requests.length);

    if (requests && requests.length > 0) {
      console.log("📋 First request details:", requests[0]);
      console.log("🆔 First request ID:", requests[0].id);
      console.log("🆔 First request ID type:", typeof requests[0].id);
      console.log("📖 First request bookId:", requests[0].bookId);
      console.log("👤 First request userId:", requests[0].userId);
    }

    const requestList = document.querySelector(".request-list");
    if (!requestList) return;

    if (!requests || requests.length === 0) {
      requestList.innerHTML = '<p class="no-requests">No pending requests.</p>';

      // Also update the count in the tab
      const pendingCountElement = document.querySelector(".tab.pending .count");
      if (pendingCountElement) {
        pendingCountElement.textContent = "0";
      }

      return;
    }

    // Fetch books and users data first
    let booksData = [];
    let usersData = [];

    try {
      const booksResponse = await makeAuthenticatedRequest(
        "/api/librarian/books",
      );
      if (booksResponse.ok) {
        booksData = await booksResponse.json();
      }

      const usersResponse = await makeAuthenticatedRequest(
        "/api/librarian/users",
      );
      if (usersResponse.ok) {
        usersData = await usersResponse.json();
      }
    } catch (error) {
      console.error("Error fetching additional data:", error);
    }

    requestList.innerHTML = requests
      .map((request) => {
        // Find book and user details from fetched data
        const book = booksData.find((b) => b.isbn === request.bookId) || {};
        const user =
          usersData.find((u) => {
            const uId = u.id ? u.id.toString().toLowerCase() : "";
            const searchId = request.userId
              ? request.userId.toString().toLowerCase()
              : "";
            return uId === searchId;
          }) || {};

        return `
      <div class="request-item" data-request-id="${request.id}">
        <div class="wrapper-request">
          <div class="book-info">
            <span class="book-icon">📖</span>
            <div>
              <div class="book-title">${book.bookName || "Unknown Book"}</div>
              <div class="student-name">${
                user.name || `User ID: ${request.userId}`
              }</div>
              <div class="request-time">Requested: ${new Date(
                request.requestDate || request.issueDate || Date.now(),
              ).toLocaleDateString()}</div>
            </div>
          </div>
        </div>
        <div class="request-actions">
          <span class="status pending">Pending</span>
          <button class="action-btn approve-btn" data-request-id="${
            request.id
          }">✓ Approve</button>
          <button class="action-btn reject-btn" data-request-id="${
            request.id
          }">✗ Reject</button>
        </div>
      </div>
    `;
      })
      .join("");

    // Update the count in the tab
    const pendingCountElement = document.querySelector(".tab.pending .count");
    if (pendingCountElement) {
      pendingCountElement.textContent = requests.length;
    }

    // Add event listeners to approve/reject buttons
    initializeRequestEvents();
  }

  function initializeRequestEvents() {
    console.log("🔄 ========== INITIALIZE REQUEST EVENTS DEBUG ==========");

    // Approve buttons
    document.querySelectorAll(".approve-btn").forEach((button, index) => {
      console.log(`🔍 Approve button ${index + 1}:`, button);
      console.log(`📝 Button text:`, button.textContent);
      console.log(`🏷️ Data attributes:`, button.dataset);

      button.addEventListener("click", (e) => {
        console.log("🟢 ========== APPROVE BUTTON CLICKED ==========");
        console.log("🎯 Clicked element:", e.target);
        console.log("🏷️ All data attributes:", e.target.dataset);
        console.log("📋 request-id value:", e.target.dataset.requestId);
        console.log("📋 request-id type:", typeof e.target.dataset.requestId);
        console.log(
          "📋 request-id length:",
          e.target.dataset.requestId
            ? e.target.dataset.requestId.length
            : "null",
        );

        const requestId = e.target.dataset.requestId;
        console.log("🆔 Request ID to send:", requestId);

        // Check if it looks like a MongoDB ObjectId
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(requestId);
        console.log("🔍 Is MongoDB ObjectId format?", isObjectId);

        approveRequest(requestId);
      });
    });

    // Reject buttons
    document.querySelectorAll(".reject-btn").forEach((button, index) => {
      console.log(`🔍 Reject button ${index + 1}:`, button);
      console.log(`📝 Button text:`, button.textContent);
      console.log(`🏷️ Data attributes:`, button.dataset);

      button.addEventListener("click", (e) => {
        console.log("🔴 ========== REJECT BUTTON CLICKED ==========");
        console.log("🎯 Clicked element:", e.target);
        console.log("🏷️ All data attributes:", e.target.dataset);
        console.log("📋 request-id value:", e.target.dataset.requestId);

        const requestId = e.target.dataset.requestId;
        rejectRequest(requestId);
      });
    });

    console.log(
      "✅ Total approve buttons found:",
      document.querySelectorAll(".approve-btn").length,
    );
    console.log(
      "✅ Total reject buttons found:",
      document.querySelectorAll(".reject-btn").length,
    );
    console.log("🔄 ========== END INITIALIZE REQUEST EVENTS ==========");
  }
  async function approveRequest(requestId) {
    console.log("🚀 ========== APPROVE REQUEST FUNCTION START ==========");
    console.log("📥 Input requestId:", requestId);
    console.log("📥 Input requestId type:", typeof requestId);
    console.log(
      "📥 Input requestId length:",
      requestId ? requestId.length : "null",
    );

    if (!confirm("Are you sure you want to approve this request?")) {
      console.log("❌ User cancelled approval");
      return;
    }

    const approveBtn = document.querySelector(
      `.approve-btn[data-request-id="${requestId}"]`,
    );

    console.log("🔍 Found approve button:", approveBtn);

    if (!approveBtn) {
      console.log("❌ Could not find approve button for requestId:", requestId);
      alert("Error: Could not find the request button");
      return;
    }

    const originalText = approveBtn.textContent;
    console.log("📝 Original button text:", originalText);

    // Disable button during processing
    approveBtn.disabled = true;
    approveBtn.textContent = "Approving...";
    approveBtn.style.opacity = "0.6";

    try {
      console.log("🔄 Starting approval process...");

      // Let's first check what data we have available
      const requestItem = document.querySelector(
        `.request-item[data-request-id="${requestId}"]`,
      );
      console.log("📋 Found request item:", requestItem);

      if (requestItem) {
        const bookTitle = requestItem.querySelector(".book-title")?.textContent;
        const studentName =
          requestItem.querySelector(".student-name")?.textContent;
        console.log("📚 Book title from UI:", bookTitle);
        console.log("👤 Student name from UI:", studentName);
      }

      console.log(
        "🌐 Making API call to:",
        `/api/librarian/requests/${requestId}/approve`,
      );

      const response = await makeAuthenticatedRequest(
        `/api/librarian/requests/${requestId}/approve`,
        {
          method: "PUT",
        },
      );

      console.log("📡 API Response status:", response.status);
      console.log("📡 API Response ok:", response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.log("❌ API Error response text:", errorText);

        let errorData;
        try {
          errorData = JSON.parse(errorText);
          console.log("❌ API Error response JSON:", errorData);
        } catch (e) {
          console.log("❌ API Error response is not JSON");
        }

        throw new Error(
          errorData?.message || `Failed to approve request: ${response.status}`,
        );
      }

      const result = await response.json();
      console.log("✅ API Success response:", result);

      // Reload requests to show updated list
      console.log("🔄 Reloading pending requests...");
      loadPendingRequests();

      // Show success message
      alert("✅ Request approved successfully!");
    } catch (error) {
      console.error("💥 ERROR in approveRequest:", error);
      console.error("💥 Error message:", error.message);
      console.error("💥 Error stack:", error.stack);

      alert("Error approving request: " + error.message);
    } finally {
      // Re-enable button
      console.log("🔄 Re-enabling approve button...");
      approveBtn.disabled = false;
      approveBtn.textContent = originalText;
      approveBtn.style.opacity = "1";
      console.log("🚀 ========== APPROVE REQUEST FUNCTION END ==========");
    }
  }
  async function rejectRequest(requestId) {
    if (!confirm("Are you sure you want to reject this request?")) {
      return;
    }

    const rejectBtn = document.querySelector(
      `.reject-btn[data-request-id="${requestId}"]`,
    );
    const originalText = rejectBtn.textContent;

    // Disable button during processing
    rejectBtn.disabled = true;
    rejectBtn.textContent = "Rejecting...";
    rejectBtn.style.opacity = "0.6";

    try {
      console.log("Rejecting request:", requestId);

      const response = await makeAuthenticatedRequest(
        `/api/librarian/requests/${requestId}/reject`, // ✅ CORRECT ENDPOINT
        {
          method: "PUT",
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to reject request: ${response.status}`);
      }

      const result = await response.json();
      console.log("✅ Request rejected successfully:", result);

      // Reload requests to show updated list
      loadPendingRequests();

      // Show success message
      alert("✅ Request rejected successfully!");
    } catch (error) {
      console.error("❌ Error rejecting request:", error);
      alert("Error rejecting request: " + error.message);
    } finally {
      // Re-enable button
      rejectBtn.disabled = false;
      rejectBtn.textContent = originalText;
      rejectBtn.style.opacity = "1";
    }
  }

  // ==================== RETURNS MANAGEMENT FUNCTIONS ====================
  async function loadReturnsData() {
    if (isSearchingReturns) {
      return;
    }
    try {
      console.log("🔄 Loading returns data using issued books endpoint...");

      const response = await makeAuthenticatedRequest(
        "/api/librarian/issued-books",
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch returns data: ${response.status}`);
      }

      const issuedBooks = await response.json();
      console.log("✅ Issued books received for returns:", issuedBooks);

      // Calculate returns data from issued books
      const today = new Date();
      const todayString = today.toISOString().split("T")[0];

      const returnsToday = issuedBooks.filter((book) => {
        if (book.status !== "issued") return false;
        return book.dueDate === todayString;
      }).length;

      const pendingReturns = issuedBooks.filter(
        (book) => book.status === "issued",
      ).length;

      const lateReturns = issuedBooks.filter((book) => {
        if (book.status !== "issued") return false;
        const dueDate = new Date(book.dueDate);
        const today = new Date();
        dueDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        return dueDate < today;
      }).length;

      const returnsData = {
        returnsToday,
        pendingReturns,
        lateReturns,
        returnsList: issuedBooks
          .filter((book) => book.status === "issued")
          .map((book) => {
            const dueDate = new Date(book.dueDate);
            const today = new Date();

            dueDate.setHours(0, 0, 0, 0);
            today.setHours(0, 0, 0, 0);

            const isLate = dueDate < today;
            const isDueToday = book.dueDate === todayString;
            const userName = book.userName || `User ID: ${book.userId}`;

            // ✅ FIX: Ensure we have the correct ID
            const issueId = book.id || book._id;
            console.log(`📋 Book: ${book.bookTitle}, Issue ID: ${issueId}`);

            return {
              id: issueId, // ✅ Use the correct ID
              bookId: book.bookId,
              bookTitle: book.bookTitle || "Unknown Book",
              bookAuthor: book.bookAuthor || "Unknown Author",
              userId: book.userId,
              userName: userName,
              issueDate: book.issueDate,
              dueDate: book.dueDate,
              status: isLate ? "late" : isDueToday ? "due-today" : "pending",
              overdueDays: isLate
                ? Math.ceil(
                    (new Date() - new Date(book.dueDate)) /
                      (1000 * 60 * 60 * 24),
                  )
                : 0,
              fineAmount: isLate
                ? Math.ceil(
                    (new Date() - new Date(book.dueDate)) /
                      (1000 * 60 * 60 * 24),
                  )
                : 0,
            };
          }),
      };

      console.log("✅ Returns data calculated with IDs");

      // Update the summary cards
      updateReturnsSummary(returnsData);

      // Display the returns list
      displayReturnsList(returnsData.returnsList);
    } catch (error) {
      console.error("❌ Error loading returns data:", error);
      const returnList = document.querySelector(".return-list");
      if (returnList) {
        returnList.innerHTML =
          '<p class="error">Error loading returns data: ' +
          error.message +
          "</p>";
      }
    }
  }

  function updateReturnsSummary(data) {
    console.log("📊 Updating returns summary:", data);

    // Update the summary cards
    const returnsTodayElement = document.querySelector(".returns-count");
    const pendingReturnsElement = document.querySelector(".pending-count");
    const lateReturnsElement = document.querySelector(".late-count");

    if (returnsTodayElement) {
      returnsTodayElement.textContent = data.returnsToday;
    }
    if (pendingReturnsElement) {
      pendingReturnsElement.textContent = data.pendingReturns;
    }
    if (lateReturnsElement) {
      lateReturnsElement.textContent = data.lateReturns;
    }
  }

  function displayReturnsList(returnsList) {
    const returnListContainer = document.querySelector(".return-list");
    if (!returnListContainer) return;

    if (!returnsList || returnsList.length === 0) {
      returnListContainer.innerHTML =
        '<p class="no-returns">No pending returns found.</p>';
      return;
    }

    returnListContainer.innerHTML = returnsList
      .map((returnItem) => {
        const dueDate = new Date(returnItem.dueDate);
        const today = new Date();

        // Determine status class and text based on the status from backend
        let statusClass = returnItem.status;
        let statusText = "";

        if (returnItem.status === "late") {
          statusText = `${returnItem.overdueDays} days overdue`;
        } else if (returnItem.status === "due-today") {
          statusText = "Due Today";
        } else {
          statusText = "Active";
        }

        return `
        <div class="return-item ${statusClass}">
          <div class="item-info">
            <span class="icon">📖</span>
            <div class="item-details">
              <strong>${returnItem.bookTitle}</strong>
              <p>${returnItem.userName}</p>
              <span class="due-date">Due: ${dueDate.toLocaleDateString()}</span>
              <span class="status ${statusClass}">${statusText}</span>
              ${
                returnItem.status === "late"
                  ? `<span class="fine-amount">Fine: $${returnItem.fineAmount}</span>`
                  : ""
              }
            </div>
          </div>
          <div class="item-actions">
            <button class="process-btn" data-issue-id="${returnItem.id}">
              Process Return
            </button>
          </div>
        </div>
      `;
      })
      .join("");

    console.log(
      "✅ Returns list displayed with buttons:",
      returnListContainer.querySelectorAll(".process-btn").length,
    );

    // Add event listeners to process return buttons
    initializeReturnsEvents();
  }
  function initializeReturnsEvents() {
    // Process return buttons
    document.querySelectorAll(".process-btn").forEach((button, index) => {
      console.log(`🔍 Process button ${index + 1}:`, button);
      console.log(`📋 Button data-issue-id:`, button.dataset.issueId);

      button.addEventListener("click", (e) => {
        console.log("🟢 Process return button clicked");
        console.log("🎯 Clicked element:", e.target);
        console.log("🏷️ All data attributes:", e.target.dataset);

        const issueId = e.target.dataset.issueId;
        console.log("🆔 Issue ID from data attribute:", issueId);

        if (!issueId || issueId === "undefined") {
          console.error("❌ No issue ID found in data attribute");
          alert(
            "Error: Could not find the book issue record. Please refresh the page and try again.",
          );
          return;
        }

        processBookReturnFromReturns(issueId);
      });
    });
  }
  // For "Process Return" button in Returns section
  async function processBookReturnFromReturns(issueId) {
    console.log("🔄 ========== PROCESS RETURN FROM RETURNS START ==========");
    console.log("📥 ApprovedBook ID received:", issueId);

    try {
      const returnItem = document.querySelector(
        `.process-btn[data-issue-id="${issueId}"]`,
      );

      if (!returnItem) {
        console.error("❌ Could not find return button for ID:", issueId);
        alert(
          "Error: Could not find the return button. Please refresh the page.",
        );
        return;
      }

      const bookTitle = returnItem
        .closest(".return-item")
        .querySelector("strong").textContent;
      console.log("📚 Book title:", bookTitle);

      if (
        !confirm(`Are you sure you want to process return for "${bookTitle}"?`)
      ) {
        console.log("❌ User cancelled return");
        return;
      }

      // Disable button during processing
      returnItem.disabled = true;
      returnItem.textContent = "Processing...";
      returnItem.style.opacity = "0.6";

      console.log("🌐 Making API call to return endpoint...");
      const response = await makeAuthenticatedRequest(
        `/api/librarian/issues/${issueId}/return`,
        {
          method: "PUT",
        },
      );

      console.log("📡 API Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Return API error response:", errorText);
        throw new Error(`Failed to process return: ${response.status}`);
      }

      const result = await response.json();
      console.log("✅ Book return processed successfully:", result);

      // Reload returns data
      console.log("🔄 Reloading returns data...");
      await loadReturnsData();

      // Reload manage books to show updated status
      console.log("🔄 Reloading manage books...");
      await loadManageBooks();

      // Show success message
      let successMessage = "✅ Book returned successfully!\n";
      successMessage += `📚 "${result.returnedBook.bookName}" is now available.\n`;

      if (result.emailSent) {
        successMessage += "📧 Confirmation email sent to user.";
      }

      alert(successMessage);
    } catch (error) {
      console.error("❌ Error processing return:", error);
      alert("Error processing return: " + error.message);

      // Re-enable button on error
      const returnItem = document.querySelector(
        `.process-btn[data-issue-id="${issueId}"]`,
      );
      if (returnItem) {
        returnItem.disabled = false;
        returnItem.textContent = "Process Return";
        returnItem.style.opacity = "1";
      }
    } finally {
      console.log("🔄 ========== PROCESS RETURN FROM RETURNS END ==========");
    }
  }

  async function returnBook(bookId) {
    console.log("🔄 ========== RETURN BOOK FROM MANAGE BOOKS START ==========");
    console.log("📥 Book ISBN received:", bookId);

    // ✅ Check if already processing a return
    if (isProcessingReturn) {
      alert("Please wait, another book is being returned...");
      return;
    }

    // Get the return button
    const returnButton = document.querySelector(
      `.return-book[data-book-id="${bookId}"]`,
    );
    if (!returnButton) {
      console.error("❌ Return button not found for book:", bookId);
      return;
    }

    const originalText = returnButton.textContent;

    // ✅ Set global flag and disable button
    isProcessingReturn = true;
    returnButton.disabled = true;
    returnButton.textContent = "Returning...";
    returnButton.style.opacity = "0.6";

    try {
      console.log("🔍 Searching for approved book record...");
      const approvedResponse = await makeAuthenticatedRequest(
        "/api/librarian/issued-books",
      );

      if (!approvedResponse.ok) {
        throw new Error(
          `Failed to fetch issued books: ${approvedResponse.status}`,
        );
      }

      const approvedBooks = await approvedResponse.json();
      console.log("📋 All approved books:", approvedBooks);

      // ✅ Find the specific issue record for this book
      const approvedRecord = approvedBooks.find(
        (book) =>
          book.bookId === bookId &&
          (book.status === "issued" || book.status === "overdue"),
      );

      if (!approvedRecord) {
        throw new Error(
          "No active issue record found for this book. It may already be returned.",
        );
      }

      console.log("✅ Found approved record:", {
        _id: approvedRecord._id,
        bookId: approvedRecord.bookId,
        status: approvedRecord.status,
      });

      // ✅ STEP 2: Single confirmation
      const bookName = approvedRecord.bookTitle || "this book";
      if (!confirm(`Are you sure you want to return "${bookName}"?`)) {
        return;
      }

      // ✅ STEP 3: FIX - Use _id from MongoDB
      const issueId = approvedRecord._id;
      console.log("🌐 Calling return endpoint with ApprovedBook _id:", issueId);
      const response = await makeAuthenticatedRequest(
        `/api/librarian/issues/${issueId}/return`,
        {
          method: "PUT",
        },
      );

      console.log("📡 API Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Return API error:", errorText);

        let errorMessage = "Failed to return book";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log("✅ Book returned successfully:", result);

      // ✅ STEP 4: Reload books and show success
      await loadManageBooks();

      // ✅ STEP 5: Single success message
      let successMessage = "✅ Book returned successfully!\n";
      successMessage += `📚 "${
        result.returnedBook?.bookName || bookName
      }" is now available.\n`;

      if (result.emailSent) {
        successMessage += "📧 Confirmation email sent to user.";
      }

      alert(successMessage);
      return result;
    } catch (error) {
      console.error("❌ Error returning book:", error);
      alert("❌ Error returning book: " + error.message);
      throw error;
    } finally {
      // ✅ IMPORTANT: Reset global flag and re-enable button
      isProcessingReturn = false;
      if (returnButton) {
        returnButton.disabled = false;
        returnButton.textContent = originalText;
        returnButton.style.opacity = "1";
      }
    }
  }
  // Search functionality for returns
  async function searchReturns(searchTerm) {
    try {
      const returnListContainer = document.querySelector(".return-list");

      if (!searchTerm.trim()) {
        isSearchingReturns = false;
        loadReturnsData();
        return;
      }

      isSearchingReturns = true;

      if (returnListContainer) {
        returnListContainer.innerHTML =
          '<div class="loading">Searching returns...</div>';
      }

      // First get all returns data using the same method as loadReturnsData
      const response = await makeAuthenticatedRequest(
        "/api/librarian/issued-books",
      );

      if (!response.ok) {
        throw new Error("Failed to search returns");
      }

      const issuedBooks = await response.json();

      // Calculate the same returns data structure as loadReturnsData
      const today = new Date();
      const todayString = today.toISOString().split("T")[0];

      // Filter and map the data first
      const allReturns = issuedBooks
        .filter((book) => book.status === "issued")
        .map((book) => {
          const dueDate = new Date(book.dueDate);
          const today = new Date();

          dueDate.setHours(0, 0, 0, 0);
          today.setHours(0, 0, 0, 0);

          const isLate = dueDate < today;
          const isDueToday = book.dueDate === todayString;
          const userName = book.userName || `User ID: ${book.userId}`;

          return {
            id: book.id,
            bookId: book.bookId,
            bookTitle: book.bookTitle || "Unknown Book",
            bookAuthor: book.bookAuthor || "Unknown Author",
            userId: book.userId,
            userName: userName,
            issueDate: book.issueDate,
            dueDate: book.dueDate,
            status: isLate ? "late" : isDueToday ? "due-today" : "pending",
            overdueDays: isLate
              ? Math.ceil(
                  (new Date() - new Date(book.dueDate)) / (1000 * 60 * 60 * 24),
                )
              : 0,
            fineAmount: isLate
              ? Math.ceil(
                  (new Date() - new Date(book.dueDate)) / (1000 * 60 * 60 * 24),
                )
              : 0,
          };
        });

      // Now filter based on search term
      const filteredReturns = allReturns.filter((returnItem) => {
        const searchLower = searchTerm.toLowerCase();
        return (
          returnItem.bookTitle.toLowerCase().includes(searchLower) ||
          returnItem.userName.toLowerCase().includes(searchLower) ||
          returnItem.bookAuthor.toLowerCase().includes(searchLower) ||
          returnItem.bookId.toLowerCase().includes(searchLower)
        );
      });

      console.log("🔍 Search results:", {
        searchTerm,
        totalReturns: allReturns.length,
        filteredCount: filteredReturns.length,
      });

      // Update summary with filtered counts
      const filteredData = {
        returnsToday: filteredReturns.filter(
          (item) => item.status === "due-today",
        ).length,
        pendingReturns: filteredReturns.length,
        lateReturns: filteredReturns.filter((item) => item.status === "late")
          .length,
        returnsList: filteredReturns,
      };

      updateReturnsSummary(filteredData);
      displayReturnsList(filteredReturns);
      isSearchingReturns = false;
    } catch (error) {
      console.error("❌ Error searching returns:", error);
      const returnListContainer = document.querySelector(".return-list");
      if (returnListContainer) {
        returnListContainer.innerHTML =
          '<p class="error">Error searching returns: ' + error.message + "</p>";
      }
    }
  }

  // ==================== FINES MANAGEMENT FUNCTIONS ====================

  // ==================== FINES MANAGEMENT FUNCTIONS ====================

  async function loadFinesData() {
    if (isSearchingFines) {
      return;
    }
    try {
      console.log("🔄 Loading fines data...");

      // Use the existing fines endpoint
      const response = await makeAuthenticatedRequest("/api/librarian/fines");

      console.log("📡 Fines API Response status:", response.status);

      if (!response.ok) {
        throw new Error(`Failed to fetch fines data: ${response.status}`);
      }

      const allFines = await response.json();
      console.log("✅ All fines received:", allFines);

      // Calculate summary data
      const unpaidFines = allFines.filter((fine) => fine.status === "overdue");
      const paidFines = allFines.filter((fine) => fine.status === "paid");

      const totalUnpaid = unpaidFines.reduce(
        (sum, fine) => sum + (fine.fineAmount || 0),
        0,
      );
      const activeFines = unpaidFines.length;
      const totalPaidFines = paidFines.length;

      // SIMPLE: Just use the fine data as-is without user lookup
      const finesList = unpaidFines.map((fine) => {
        const dueDate = new Date(fine.dueDate);
        const today = new Date();
        const overdueDays = Math.ceil(
          (today - dueDate) / (1000 * 60 * 60 * 24),
        );

        return {
          id: fine.id,
          bookId: fine.bookId,
          bookTitle: fine.bookTitle || "Unknown Book",
          bookAuthor: fine.bookAuthor || "Unknown Author",
          userId: fine.userId,
          userName: `User ID: ${fine.userId}`, // Simple user display
          issueDate: fine.issueDate,
          dueDate: fine.dueDate,
          overdueDays: overdueDays > 0 ? overdueDays : 0,
          fineAmount: fine.fineAmount || 0,
          status: fine.status,
        };
      });

      const finesData = {
        totalUnpaid,
        activeFines,
        totalPaidFines,
        finesList,
        summary: {
          totalUnpaid,
          activeFines,
          totalPaidFines,
          totalCollected: paidFines.reduce(
            (sum, fine) => sum + (fine.fineAmount || 0),
            0,
          ),
        },
      };

      console.log("✅ Fines data calculated:", finesData);

      // Update the overview cards
      updateFinesSummary(finesData.summary);

      // Display the fines list
      displayFinesList(finesData.finesList);
    } catch (error) {
      console.error("❌ Error loading fines data:", error);
      // Show error in UI
      const finesTable = document.querySelector(".fines-table tbody");
      if (finesTable) {
        finesTable.innerHTML =
          '<tr><td colspan="7" class="error">Error loading fines data: ' +
          error.message +
          "</td></tr>";
      }
    }
  }

  function updateFinesSummary(summary) {
    console.log("📊 Updating fines summary:", summary);

    // Update the overview cards
    const totalUnpaidElement = document.querySelector(
      ".overview-card.unpaid p",
    );
    const activeFinesElement = document.querySelector(
      ".overview-card.active p",
    );
    const paidFinesElement = document.querySelector(".overview-card.paid p");
    const totalAmountElement = document.querySelector(".total-amount");

    if (totalUnpaidElement) {
      totalUnpaidElement.textContent = `$${summary.totalUnpaid || 0}`;
    }
    if (activeFinesElement) {
      activeFinesElement.textContent = summary.activeFines || 0;
    }
    if (paidFinesElement) {
      paidFinesElement.textContent = summary.totalPaidFines || 0;
    }
    if (totalAmountElement) {
      totalAmountElement.textContent = `$${summary.totalUnpaid || 0}`;
    }
  }

  function displayFinesList(finesList) {
    const finesTableBody = document.querySelector(".fines-table tbody");
    if (!finesTableBody) return;

    if (!finesList || finesList.length === 0) {
      finesTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="no-fines">
          No active fines found. All fines are paid up! 🎉
        </td>
      </tr>
    `;
      return;
    }

    finesTableBody.innerHTML = finesList
      .map((fine) => {
        const dueDate = new Date(fine.dueDate);
        const isSevere = fine.overdueDays > 7;
        const isModerate = fine.overdueDays > 3;

        return `
        <tr class="${
          isSevere ? "severe-fine" : isModerate ? "moderate-fine" : ""
        }">
          <td>
            <strong>${fine.bookTitle}</strong>
            <br>
            <small>${fine.bookAuthor}</small>
          </td>
          <td>
            <strong>${fine.userName}</strong>
            <br>
            <small>${fine.userEmail}</small>
          </td>
          <td>${dueDate.toLocaleDateString()}</td>
          <td>
            <span class="overdue-days ${
              isSevere ? "severe" : isModerate ? "moderate" : "mild"
            }">
              ${fine.overdueDays} days
            </span>
          </td>
          <td>
            <strong class="fine-amount">$${fine.fineAmount}</strong>
          </td>
          <td>
            <span class="status-unpaid">Unpaid</span>
          </td>
          <td>
            <button class="mark-paid" data-fine-id="${fine.id}">
              Mark as Paid
            </button>
          </td>
        </tr>
      `;
      })
      .join("");

    // Add event listeners to mark as paid buttons
    initializeFinesEvents();
  }

  function initializeFinesEvents() {
    // Mark as paid buttons
    document.querySelectorAll(".mark-paid").forEach((button) => {
      button.addEventListener("click", (e) => {
        const fineId = e.target.dataset.fineId;
        const bookTitle = e.target
          .closest("tr")
          .querySelector("td:first-child strong").textContent;
        markFineAsPaid(fineId, bookTitle);
      });
    });
  }

  async function markFineAsPaid(fineId, bookTitle) {
    try {
      if (
        confirm(
          `Are you sure you want to mark the fine for "${bookTitle}" as paid? This will also return the book.`,
        )
      ) {
        // Disable button during processing
        const button = document.querySelector(
          `.mark-paid[data-fine-id="${fineId}"]`,
        );
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = "Processing...";
        button.style.opacity = "0.6";

        const response = await makeAuthenticatedRequest(
          `/api/librarian/fines/${fineId}/paid`,
          {
            method: "PUT",
          },
        );

        if (!response.ok) {
          throw new Error(`Failed to mark fine as paid: ${response.status}`);
        }

        const result = await response.json();
        console.log("✅ Fine marked as paid:", result);

        // Reload fines data
        loadFinesData();

        alert(
          "✅ Fine marked as paid successfully! The book has been returned.",
        );
      }
    } catch (error) {
      console.error("❌ Error marking fine as paid:", error);
      alert("Error marking fine as paid: " + error.message);

      // Re-enable button on error
      const button = document.querySelector(
        `.mark-paid[data-fine-id="${fineId}"]`,
      );
      if (button) {
        button.disabled = false;
        button.textContent = "Mark as Paid";
        button.style.opacity = "1";
      }
    }
  }

  // Search functionality for fines
  // Search functionality for fines - FIXED
  async function searchFines(searchTerm) {
    try {
      const finesTableBody = document.querySelector(".fines-table tbody");

      if (!searchTerm.trim()) {
        isSearchingFines = false;
        loadFinesData();
        return;
      }

      isSearchingFines = true;

      if (finesTableBody) {
        finesTableBody.innerHTML =
          '<tr><td colspan="7" class="loading">Searching fines...</td></tr>';
      }

      // Use the same method as loadFinesData
      const response = await makeAuthenticatedRequest("/api/librarian/fines");

      if (!response.ok) {
        throw new Error("Failed to search fines");
      }

      const allFines = await response.json();

      // Filter unpaid fines
      const unpaidFines = allFines.filter((fine) => fine.status === "overdue");

      // Filter based on search term
      const filteredFines = unpaidFines.filter((fine) => {
        const searchLower = searchTerm.toLowerCase();
        return (
          fine.bookTitle.toLowerCase().includes(searchLower) ||
          fine.bookAuthor.toLowerCase().includes(searchLower) ||
          fine.userId.toString().includes(searchTerm)
        );
      });

      console.log("🔍 Fines search results:", {
        searchTerm,
        totalFines: unpaidFines.length,
        filteredCount: filteredFines.length,
      });

      // Calculate summary for filtered results
      const filteredSummary = {
        totalUnpaid: filteredFines.reduce(
          (sum, fine) => sum + (fine.fineAmount || 0),
          0,
        ),
        activeFines: filteredFines.length,
        totalPaidFines: allFines.filter((fine) => fine.status === "paid")
          .length,
        totalCollected: allFines
          .filter((fine) => fine.status === "paid")
          .reduce((sum, fine) => sum + (fine.fineAmount || 0), 0),
      };

      updateFinesSummary(filteredSummary);
      displayFinesList(filteredFines);
      isSearchingFines = false;
    } catch (error) {
      console.error("❌ Error searching fines:", error);
      const finesTableBody = document.querySelector(".fines-table tbody");
      if (finesTableBody) {
        finesTableBody.innerHTML =
          '<tr><td colspan="7" class="error">Error searching fines. Please try again.</td></tr>';
      }
    }
  }
  // ==================== EVENT LISTENERS AND INITIALIZATION ====================

  // Navigation
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      isSearchingBooks = false;
      isSearchingUsers = false;
      isSearchingReturns = false;
      isSearchingFines = false;
      document
        .querySelectorAll(".nav-link")
        .forEach((l) => l.classList.remove("active"));
      link.classList.add("active");
      const viewId = link.dataset.view;
      document
        .querySelectorAll(".view")
        .forEach((view) => view.classList.remove("active"));
      document.getElementById(viewId).classList.add("active");

      // Load data when switching to specific views
      if (viewId === "dashboard") {
        loadDashboardData();
      } else if (viewId === "manageBooks") {
        loadManageBooks();
      } else if (viewId === "manageUsers") {
        loadManageUsers();
      } else if (viewId === "issuedBooks") {
        loadIssuedBooks();
      } else if (viewId === "requests") {
        loadPendingRequests(); // ✅ ADD THIS LINE
      } else if (viewId === "returns") {
        loadReturnsData(); // ✅ ADD THIS LINE
      } else if (viewId === "fines") {
        loadFinesData(); // ✅ ADD THIS LINE
      }

      // Close mobile menu if open
      const mobileMenu = document.getElementById("mobileMenu");
      mobileMenu.classList.remove("active");
    });
  });

  function handleUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get("view");

    if (viewParam) {
      // Find and click the corresponding nav link
      const targetLink = document.querySelector(
        `.nav-link[data-view="${viewParam}"]`,
      );
      if (targetLink) {
        targetLink.click();
      }

      // Clean the URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }

  handleUrlParams();

  // Search functionality for Manage Books
  const manageBooksSearchInput = document.querySelector(
    '#manageBooks input[type="text"]',
  );
  if (manageBooksSearchInput) {
    let searchTimeout;
    manageBooksSearchInput.addEventListener("input", (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        searchManageBooks(e.target.value);
      }, 300);
    });
  }

  // User search functionality
  const userSearchBox = document.getElementById("userSearchBox");
  if (userSearchBox) {
    let searchTimeout;
    userSearchBox.addEventListener("input", (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        searchUsers(e.target.value);
      }, 300);
    });
  }
  // Returns search functionality
  const returnsSearchInput = document.querySelector(
    '#returns input[type="text"]',
  );
  if (returnsSearchInput) {
    let searchTimeout;
    returnsSearchInput.addEventListener("input", (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        searchReturns(e.target.value);
      }, 300);
    });
  }

  const finesSearchInput = document.querySelector('#fines input[type="text"]');
  if (finesSearchInput) {
    let searchTimeout;
    finesSearchInput.addEventListener("input", (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        searchFines(e.target.value);
      }, 300);
    });
  }
  // Edit book form submission
  // REPLACE ONLY the edit book form submission with this:
  const editBookForm = document.querySelector("#editBooksModal form");
  if (editBookForm) {
    editBookForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const originalBookId = document
        .getElementById("editBookStudentId")
        .getAttribute("data-original-id");
      const bookData = {
        bookName: document.getElementById("editBookTitle").value,
        authorName: document.getElementById("editBookAuthor").value,
        department: document.getElementById("editBookStudentDept").value,
        isbn: document.getElementById("editBookStudentId").value,
      };

      console.log("Updating book:", originalBookId, "Data:", bookData);

      try {
        await editBook(originalBookId, bookData);
      } catch (error) {
        console.error("Error in form submission:", error);
      }
    });
  }

  // Issue book form submission:
  // Issue book form submission - UPDATED VERSION:
  const issueBookForm = document.querySelector("#issueBooksModal form");
  if (issueBookForm) {
    issueBookForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      console.log("🎯 Issue book form submitted");

      // ✅ Get the submit button
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;

      const userIdInput = document.getElementById("userID");
      const userId = userIdInput ? userIdInput.value.trim() : "";

      // Get book ID from modal data attribute
      const issueBooksModal = document.querySelector("#issueBooksModal");
      let bookId = issueBooksModal
        ? issueBooksModal.getAttribute("data-current-book-id")
        : null;

      console.log("📝 Final Form Data:", { userId, bookId });

      // Validate inputs
      if (!userId) {
        alert("❌ Please enter User ID");
        userIdInput?.focus();
        return;
      }

      if (!bookId) {
        alert(
          "❌ Error: No book selected. Please close the modal and try again.",
        );
        return;
      }

      const issueData = {
        userId: userId,
        bookId: bookId,
      };

      console.log("🚀 Sending issue request:", issueData);

      try {
        await issueBook(issueData);
      } catch (error) {
        console.error("💥 Form submission error:", error);
        // Button will be re-enabled in the finally block of issueBook function
      }
    });
  }
  //Edit user

  async function editUser(originalUserId, userData) {
    try {
      console.log(
        "🔄 Sending update for user:",
        originalUserId,
        "Data:",
        userData,
      );

      const response = await makeAuthenticatedRequest(
        `/api/librarian/users/${originalUserId}`,
        {
          method: "PUT",
          body: JSON.stringify(userData),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Update error response:", errorText);

        let errorMessage = "Failed to update user";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log("✅ User updated successfully:", result);

      // Close modal
      const editUserModal = document.querySelector("#editUserModal");
      if (editUserModal) {
        editUserModal.style.display = "none";
      }
      if (overlay) overlay.style.display = "none";

      // Reload users list
      loadManageUsers();

      alert("User updated successfully!");
      return result;
    } catch (error) {
      console.error("❌ Error updating user:", error);

      // Show specific error messages
      if (error.message.includes("User with this ID already exists")) {
        alert(
          "❌ A user with this ID already exists. Please use a different ID.",
        );
      } else if (error.message.includes("User not found")) {
        alert("❌ User not found. The user may have been deleted.");
      } else {
        alert(`❌ Update failed: ${error.message}`);
      }

      throw error;
    }
  }
  // IN the initializeUserEvents function, REPLACE ONLY the edit user buttons part:
  function initializeUserEvents() {
    console.log("🔄 ========== INITIALIZE USER EVENTS START ==========");

    // ✅ FIX: Remove all existing event listeners first by cloning elements
    document.querySelectorAll(".edit-user").forEach((button, index) => {
      console.log(`🔄 Replacing edit button ${index + 1}`);
      button.replaceWith(button.cloneNode(true));
    });

    document
      .querySelectorAll(".delete-user:not(.disabled)")
      .forEach((button, index) => {
        console.log(`🔄 Replacing delete button ${index + 1}`);
        button.replaceWith(button.cloneNode(true));
      });

    // ✅ FIX: Edit user buttons - fresh event listeners with DEBUG
    document.querySelectorAll(".edit-user").forEach((button, index) => {
      console.log(`🔍 Setting up edit button ${index + 1}:`, button);
      console.log(
        `📋 Button data-user-id:`,
        button.getAttribute("data-user-id"),
      );

      button.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const userId = button.getAttribute("data-user-id");
        console.log("✏️ ========== EDIT USER CLICKED ==========");
        console.log("🎯 Clicked element:", button);
        console.log("📋 data-user-id attribute:", userId);
        console.log("📋 data-user-id type:", typeof userId);
        console.log("📋 data-user-id length:", userId ? userId.length : "null");

        // ✅ DEBUG: Check if we have the user ID
        if (!userId) {
          console.error("❌ No user ID found in data attribute!");
          alert("Error: Could not find user ID. Please refresh the page.");
          return;
        }

        // ✅ DEBUG: Check if modal exists
        const editUserModal = document.querySelector("#editUserModal");
        console.log("🔍 Edit modal found:", !!editUserModal);

        if (editUserModal) {
          console.log("🔍 Modal display before:", editUserModal.style.display);
        }

        try {
          console.log("🔄 Opening edit modal for user:", userId);

          // Load user details and open edit modal
          await loadUserDetails(userId);

          if (editUserModal) {
            editUserModal.style.display = "flex";
            if (overlay) overlay.style.display = "block";

            // ✅ DEBUG: Check modal state after opening
            console.log("✅ Edit modal opened");
            console.log("🔍 Modal display after:", editUserModal.style.display);

            // ✅ DEBUG: Verify form is populated
            setTimeout(() => {
              console.log("🔍 Form verification after modal open:");
              console.log(
                "  - Hidden field:",
                document.getElementById("editUserId")?.value,
              );
              console.log(
                "  - Student ID:",
                document.getElementById("editStudentId")?.value,
              );
              console.log(
                "  - Name:",
                document.getElementById("editUserName")?.value,
              );
            }, 100);
          } else {
            console.error("❌ Edit modal not found!");
            alert("Error: Could not find edit modal. Please refresh the page.");
          }
        } catch (error) {
          console.error("❌ Failed to load user details:", error);
          alert("Error loading user: " + error.message);
        }

        console.log("✅ ========== EDIT USER CLICKED END ==========");
      });
    });

    // ✅ FIX: Delete user buttons - SINGLE handler using the enhanced function
    document
      .querySelectorAll(".delete-user:not(.disabled)")
      .forEach((button, index) => {
        console.log(`🔍 Setting up delete button ${index + 1}:`, button);

        button.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();

          const userId = button.getAttribute("data-user-id");
          const userName = button
            .closest("tr")
            .querySelector("td:first-child").textContent;

          console.log("🗑️ ========== DELETE USER CLICKED ==========");
          console.log("🎯 User ID:", userId);
          console.log("🎯 User Name:", userName);

          // Use the enhanced delete function
          deleteUserWithIssuesCheck(userId, userName);
        });
      });

    console.log(
      `✅ Total edit buttons initialized: ${
        document.querySelectorAll(".edit-user").length
      }`,
    );
    console.log(
      `✅ Total delete buttons initialized: ${
        document.querySelectorAll(".delete-user:not(.disabled)").length
      }`,
    );
    console.log("🔄 ========== INITIALIZE USER EVENTS END ==========");
  }
  // Hamburger menu toggle
  const hamburger = document.getElementById("hamburger");
  const mobileMenu = document.getElementById("mobileMenu");
  hamburger.addEventListener("click", () => {
    mobileMenu.classList.toggle("active");
  });

  // Close mobile menu on outside click
  document.addEventListener("click", (e) => {
    if (!hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
      mobileMenu.classList.remove("active");
    }
  });

  // Add users logic - UPDATED VERSION
  const addUserBtn = document.querySelector("#addUserBtn");
  const addUserModal = document.querySelector("#addUserModal");
  const closeFormBtn = document.querySelector("#closeAddUserModal");

  addUserBtn.addEventListener("click", () => {
    addUserModal.style.display = "flex";
    overlay.style.display = "block";
    // Re-initialize the form when modal opens
    setTimeout(initializeAddUserForm, 100);
  });

  closeFormBtn.addEventListener("click", () => {
    addUserModal.style.display = "none";
    overlay.style.display = "none";
  });

  overlay.addEventListener("click", () => {
    addUserModal.style.display = "none";
    overlay.style.display = "none";
  });

  // Close edit books modal
  const closeEditBooksFormBtn = document.querySelector("#closeEditBooksModal");
  if (closeEditBooksFormBtn) {
    closeEditBooksFormBtn.addEventListener("click", () => {
      const editBooksModal = document.querySelector("#editBooksModal");
      editBooksModal.style.display = "none";
      if (overlay) overlay.style.display = "none";
    });
  }

  // ✅ Make sure this close handler exists
  const closeIssueBooksModal = document.querySelector("#closeIssueBooksModal");
  if (closeIssueBooksModal) {
    closeIssueBooksModal.addEventListener("click", () => {
      const issueBooksModal = document.querySelector("#issueBooksModal");
      if (issueBooksModal) {
        issueBooksModal.style.display = "none";
        issueBooksModal.removeAttribute("data-current-book-id");
      }
      window.currentIssueBookId = null;
      if (overlay) overlay.style.display = "none";

      // Clear the form
      const userIDInput = document.getElementById("userID");
      if (userIDInput) {
        userIDInput.value = "";
      }
    });
  }

  // ==================== MODAL CLOSE HANDLERS ====================

  const cancelIssueBook = document.querySelector("#cancelIssueBook");
  if (cancelIssueBook) {
    cancelIssueBook.addEventListener("click", () => {
      const issueBooksModal = document.querySelector("#issueBooksModal");
      if (issueBooksModal) {
        issueBooksModal.style.display = "none";
        issueBooksModal.removeAttribute("data-current-book-id");
      }
      window.currentIssueBookId = null;
      if (overlay) overlay.style.display = "none";
      console.log("🧹 Cleared book ID on cancel");
    });
  }

  // Edit User Modal event listeners
  const editUserModal = document.querySelector("#editUserModal");
  const closeEditUserModal = document.querySelector("#closeEditUserModal");
  const cancelEditUser = document.querySelector("#cancelEditUser");

  if (closeEditUserModal) {
    closeEditUserModal.addEventListener("click", () => {
      editUserModal.style.display = "none";
      overlay.style.display = "none";
    });
  }

  if (cancelEditUser) {
    cancelEditUser.addEventListener("click", () => {
      editUserModal.style.display = "none";
      overlay.style.display = "none";
    });
  }

  // Update overlay click to clear book IDs
  overlay.addEventListener("click", () => {
    const issueBooksModal = document.querySelector("#issueBooksModal");
    if (issueBooksModal) {
      issueBooksModal.style.display = "none";
      issueBooksModal.removeAttribute("data-current-book-id");
    }
    window.currentIssueBookId = null;

    // Close other modals
    document.querySelectorAll(".modal").forEach((modal) => {
      modal.style.display = "none";
    });

    overlay.style.display = "none";
    console.log("🧹 Cleared book ID on overlay click");
  });
  // Activate default view
  document.querySelector(".nav-link.active").click();
});
