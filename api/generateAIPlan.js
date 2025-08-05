// /api/generateAIPlan.js

// This is your Vercel Serverless Function.
// It acts as a secure backend to protect your API key.

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Get the prompt from the frontend's request body
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  // Securely get the API key from your Vercel Environment Variables
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on the server.' });
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  try {
    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    };

    // Call the Google AI API from the server
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Google AI API Error:', errorData);
      return res.status(response.status).json({ error: 'Failed to get response from AI service.' });
    }

    const data = await response.json();

    // Send the successful response back to the frontend
    res.status(200).json(data);

  } catch (error) {
    console.error('Error calling AI service:', error);
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
}
