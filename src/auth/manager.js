import { encodeBasicAuth } from "../utils.js";
import { DigestAuth } from "./digest.js";

function isRetryableBody(body) {
  if (body === undefined || body === null) {
    return true;
  }
  if (typeof body === "string") {
    return true;
  }
  if (body instanceof Uint8Array) {
    return true;
  }
  if (body instanceof Blob) {
    return true;
  }
  return false;
}

export class AuthManager {
  constructor(config = {}) {
    this.updateConfig(config);
  }

  updateConfig(config = {}) {
    this.endpoint = String(config.endpoint || "");
    this.username = String(config.username || "");
    this.password = String(config.password || "");
    this.mode = String(config.authMode || config.authType || "auto");
    this.digest = new DigestAuth({
      endpoint: this.endpoint,
      username: this.username,
      password: this.password,
      mode: this.mode
    });
  }

  canUseBasic() {
    return !!this.username;
  }

  canUseDigest() {
    return this.digest.canUseDigest();
  }

  hasDigestChallenge() {
    return !!this.digest.challenge;
  }

  prefersDigest() {
    return this.digest.prefersDigest();
  }

  observeUnauthorized(response) {
    return this.digest.observeUnauthorizedResponse(response);
  }

  seedDigestChallenge(challenge) {
    return this.digest.setChallenge(challenge);
  }

  async getPreemptiveAuthorization(method, url, body) {
    if (this.prefersDigest()) {
      if (this.digest.challenge) {
        return await this.digest.buildAuthorization(method, url, body);
      }
      return "";
    }
    if (this.digest.challenge) {
      const digestHeader = await this.digest.buildAuthorization(method, url, body);
      if (digestHeader) {
        return digestHeader;
      }
    }
    if (this.canUseBasic()) {
      return encodeBasicAuth(this.username, this.password);
    }
    return "";
  }

  async getDigestAuthorization(method, url, body) {
    return await this.digest.buildAuthorization(method, url, body);
  }

  isBodyRetryable(body) {
    return isRetryableBody(body);
  }
}

