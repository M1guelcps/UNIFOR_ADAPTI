const API_URL = "http://localhost:3000/auth";

async function apiRequest(endpoint, data) {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Ocorreu um erro no servidor.");
    }

    return result;
  } catch (error) {
    throw error;
  }
}