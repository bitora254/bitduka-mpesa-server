require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const DARAJA_CONSUMER_KEY = process.env.DARAJA_CONSUMER_KEY;
const DARAJA_CONSUMER_SECRET = process.env.DARAJA_CONSUMER_SECRET;
const DARAJA_SHORTCODE = process.env.DARAJA_SHORTCODE;
const DARAJA_PASSKEY = process.env.DARAJA_PASSKEY;
const DARAJA_CALLBACK_URL = process.env.DARAJA_CALLBACK_URL;

const BASE_URL = "https://sandbox.safaricom.co.ke";

function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

async function getAccessToken() {
  const auth = Buffer.from(
    `${DARAJA_CONSUMER_KEY}:${DARAJA_CONSUMER_SECRET}`
  ).toString("base64");

  const response = await axios.get(
    `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    }
  );

  return response.data.access_token;
}

app.get("/", (req, res) => {
  res.json({ ok: true, message: "BitDuka M-Pesa backend is running" });
});

app.post("/api/mpesa/stk", async (req, res) => {
  try {
    const { phoneNumber, amount, planName } = req.body;

    if (!phoneNumber || !amount || !planName) {
      return res.status(400).json({
        success: false,
        message: "phoneNumber, amount, and planName are required.",
      });
    }

    const timestamp = getTimestamp();
    const password = Buffer.from(
      `${DARAJA_SHORTCODE}${DARAJA_PASSKEY}${timestamp}`
    ).toString("base64");

    const accessToken = await getAccessToken();

    const payload = {
      BusinessShortCode: DARAJA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Number(amount),
      PartyA: phoneNumber,
      PartyB: DARAJA_SHORTCODE,
      PhoneNumber: phoneNumber,
      CallBackURL: DARAJA_CALLBACK_URL,
      AccountReference: planName,
      TransactionDesc: `BitDuka ${planName} subscription`,
    };

    const response = await axios.post(
      `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    return res.json({
      success: true,
      message: "STK Push started successfully.",
      merchantRequestId: response.data.MerchantRequestID,
      checkoutRequestId: response.data.CheckoutRequestID,
      responseCode: response.data.ResponseCode,
      customerMessage: response.data.CustomerMessage,
    });
  } catch (error) {
    const data = error.response?.data;

    return res.status(500).json({
      success: false,
      message:
        data?.errorMessage ||
        data?.ResponseDescription ||
        "Could not start STK Push.",
      details: data || null,
    });
  }
});

app.post("/api/mpesa/callback", (req, res) => {
  console.log("Daraja callback:", JSON.stringify(req.body, null, 2));
  return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});