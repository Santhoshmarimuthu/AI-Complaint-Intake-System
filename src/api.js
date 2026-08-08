const API_BASE = "http://localhost:8000/api/complaint";


async function request(url, options = {}) {
  const response = await fetch(url, options);

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      `Server returned ${response.status} without JSON.`
    );
  }

  if (!response.ok) {
    throw new Error(
      data.detail || "Request failed."
    );
  }

  return data;
}


export function uploadComplaint(file, sessionId = null) {
  const formData = new FormData();

  formData.append("file", file);

  if (sessionId) {
    formData.append(
      "session_id",
      sessionId
    );
  }

  return request(
    `${API_BASE}/upload`,
    {
      method: "POST",
      body: formData,
    }
  );
}


export function sendText(text, sessionId = null) {
  return request(
    `${API_BASE}/text`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        session_id: sessionId,
      }),
    }
  );
}


export function sendChat(message, sessionId) {
  return request(
    `${API_BASE}/chat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        session_id: sessionId,
      }),
    }
  );
}


export function submitComplaint(sessionId) {
  return request(
    `${API_BASE}/submit`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: sessionId,
      }),
    }
  );
}


export function searchComplaints(
  query = "",
  limit = 20
) {
  return request(
    `${API_BASE}/search?q=${encodeURIComponent(
      query
    )}&limit=${limit}`
  );
}


export function loadComplaint(complaintId) {
  return request(
    `${API_BASE}/load/${complaintId}`,
    {
      method: "POST",
    }
  );
}
