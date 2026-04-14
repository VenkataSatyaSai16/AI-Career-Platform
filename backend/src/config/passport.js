const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { env } = require("./env");
const User = require("../models/User");

function normalizeUsernameBase(email) {
  return (email.split("@")[0] || "user").replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 24) || "user";
}

async function buildUniqueUsername(email) {
  const base = normalizeUsernameBase(email);
  let username = base;
  let suffix = 1;

  while (await User.exists({ username })) {
    username = `${base}${suffix}`;
    suffix += 1;
  }

  return username;
}

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (userId, done) => {
  try {
    const user = await User.findById(userId).lean();
    done(null, user || null);
  } catch (error) {
    done(error);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: env.googleClientId,
      clientSecret: env.googleClientSecret,
      callbackURL: env.googleCallbackUrl
    },
    async (accessToken, refreshToken, params, profile, done) => {
      try {
        const googleId = String(profile?.id || "").trim();
        const name = String(profile?.displayName || "").trim();
        const email = String(profile?.emails?.[0]?.value || "").trim().toLowerCase();
        const expiresInSeconds = Number(params?.expires_in || 0);
        const tokenExpiry =
          Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
            ? new Date(Date.now() + expiresInSeconds * 1000)
            : null;

        if (!googleId || !email) {
          return done(new Error("Google profile is missing required fields"));
        }

        let user = await User.findOne({ email });

        if (user) {
          let changed = false;

          if (!user.googleId) {
            user.googleId = googleId;
            changed = true;
          }

          if (!user.name && name) {
            user.name = name;
            changed = true;
          }

          if (!user.username) {
            user.username = await buildUniqueUsername(email);
            changed = true;
          }

          if (accessToken && user.googleAccessToken !== accessToken) {
            user.googleAccessToken = accessToken;
            changed = true;
          }

          if (refreshToken && user.googleRefreshToken !== refreshToken) {
            user.googleRefreshToken = refreshToken;
            changed = true;
          }

          if (tokenExpiry) {
            user.googleTokenExpiry = tokenExpiry;
            changed = true;
          }

          if (changed) {
            await user.save();
          }

          console.log("Google OAuth user already exists:", {
            userId: user.id,
            username: user.username,
            email: user.email
          });

          return done(null, user);
        }

        user = await User.create({
          username: await buildUniqueUsername(email),
          name,
          email,
          googleId,
          googleAccessToken: accessToken || "",
          googleRefreshToken: refreshToken || "",
          googleTokenExpiry: tokenExpiry
        });

        console.log("Google OAuth user created:", {
          userId: user.id,
          username: user.username,
          email: user.email
        });

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

module.exports = passport;
