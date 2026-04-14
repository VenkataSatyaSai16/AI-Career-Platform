const { google } = require("googleapis");
const User = require("../models/User");
const { env } = require("../config/env");

function createCalendarError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function persistOAuthCredentials(userId, credentials = {}) {
  const update = {};

  if (credentials.access_token) {
    update.googleAccessToken = credentials.access_token;
  }

  if (credentials.refresh_token) {
    update.googleRefreshToken = credentials.refresh_token;
  }

  if (credentials.expiry_date) {
    update.googleTokenExpiry = new Date(credentials.expiry_date);
  }

  if (Object.keys(update).length > 0) {
    await User.findByIdAndUpdate(userId, update, { new: false });
  }
}

async function getOAuthClient(user) {
  if (!user?._id) {
    throw createCalendarError("A valid user is required for Google Calendar access", 400);
  }

  if (!env.googleClientId || !env.googleClientSecret || !env.googleRedirectUri) {
    throw createCalendarError("Google Calendar environment variables are not configured", 500);
  }

  if (!user.googleAccessToken && !user.googleRefreshToken) {
    throw createCalendarError("Google Calendar is not connected for this user", 400);
  }

  const oauth2Client = new google.auth.OAuth2(
    env.googleClientId,
    env.googleClientSecret,
    env.googleRedirectUri
  );

  oauth2Client.setCredentials({
    access_token: user.googleAccessToken || undefined,
    refresh_token: user.googleRefreshToken || undefined,
    expiry_date: user.googleTokenExpiry ? new Date(user.googleTokenExpiry).getTime() : undefined
  });

  oauth2Client.on("tokens", async (tokens) => {
    try {
      await persistOAuthCredentials(user._id, tokens);
    } catch (error) {
      console.error("Failed to persist refreshed Google OAuth tokens", {
        userId: String(user._id),
        message: error.message
      });
    }
  });

  const tokenExpired =
    !user.googleTokenExpiry || Number(new Date(user.googleTokenExpiry).getTime()) <= Date.now();

  if (tokenExpired && user.googleRefreshToken) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials({
      access_token: credentials.access_token || user.googleAccessToken || undefined,
      refresh_token: credentials.refresh_token || user.googleRefreshToken || undefined,
      expiry_date: credentials.expiry_date || undefined
    });

    await persistOAuthCredentials(user._id, {
      access_token: credentials.access_token || user.googleAccessToken,
      refresh_token: credentials.refresh_token || user.googleRefreshToken,
      expiry_date: credentials.expiry_date
    });
  }

  return oauth2Client;
}

async function createCalendarEvent(user, task) {
  const auth = await getOAuthClient(user);
  const calendar = google.calendar({ version: "v3", auth });
  const response = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: task.title,
      description: task.description || "",
      start: {
        dateTime: new Date(task.startTime).toISOString()
      },
      end: {
        dateTime: new Date(task.endTime).toISOString()
      }
    }
  });

  return response.data.id;
}

async function updateCalendarEvent(user, task) {
  if (!task.googleEventId) {
    return null;
  }

  const auth = await getOAuthClient(user);
  const calendar = google.calendar({ version: "v3", auth });
  await calendar.events.update({
    calendarId: "primary",
    eventId: task.googleEventId,
    requestBody: {
      summary: task.title,
      description: task.description || "",
      start: {
        dateTime: new Date(task.startTime).toISOString()
      },
      end: {
        dateTime: new Date(task.endTime).toISOString()
      }
    }
  });

  return task.googleEventId;
}

async function deleteCalendarEvent(user, googleEventId) {
  if (!googleEventId) {
    return;
  }

  const auth = await getOAuthClient(user);
  const calendar = google.calendar({ version: "v3", auth });
  await calendar.events.delete({
    calendarId: "primary",
    eventId: googleEventId
  });
}

module.exports = {
  createCalendarEvent,
  deleteCalendarEvent,
  getOAuthClient,
  updateCalendarEvent
};
