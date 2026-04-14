import api, { getErrorMessage, requestWithFallback } from "./api";

export async function loginUser(payload) {
  try {
    const response = await api.post("/auth/login", payload);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to log in."));
  }
}

export async function signupUser(payload) {
  try {
    const response = await api.post("/auth/signup", payload);
    return response.data;
  } catch (signupError) {
    try {
      const response = await api.post("/auth/register", payload);
      return response.data;
    } catch (registerError) {
      throw new Error(getErrorMessage(registerError || signupError, "Unable to create your account."));
    }
  }
}

export function getUserProfile() {
  return requestWithFallback([() => api.get("/user/profile"), () => api.get("/auth/me")]);
}

export function getInterviewHistory(userId) {
  return requestWithFallback([() => api.get("/interview/history"), () => api.get(`/interview/history/${userId}`)]);
}

export async function startInterview(payload) {
  try {
    const response = await api.post("/interview/start", payload);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to start interview."));
  }
}

export function submitInterviewAnswer(payload) {
  return requestWithFallback([() => api.post("/interview/answer", payload), () => api.post("/interview/next", payload)]);
}

export function getInterviewResult(interviewId) {
  return requestWithFallback([() => api.get(`/interview/result/${interviewId}`), () => api.get(`/interview/report/${interviewId}`)]);
}
