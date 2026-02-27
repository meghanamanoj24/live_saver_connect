const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000/api"

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL

function getBrowserToken() {
	if (typeof window === "undefined") {
		return null
	}
	const token = localStorage.getItem("accessToken")
	if (!token || token === "null" || token === "undefined") return null
	return token
}

function clearTokens() {
	if (typeof window === "undefined") return
	localStorage.removeItem("accessToken")
	localStorage.removeItem("refreshToken")
}

function getRefreshToken() {
	if (typeof window === "undefined") return null
	return localStorage.getItem("refreshToken")
}

function setTokens(access, refresh) {
	if (typeof window === "undefined") return
	if (access) localStorage.setItem("accessToken", access)
	if (refresh) localStorage.setItem("refreshToken", refresh)
}

function decodeJwtPayload(token) {
	try {
		const [, payload] = token.split(".")
		return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")))
	} catch {
		return null
	}
}

function isTokenExpired(token) {
	const payload = decodeJwtPayload(token)
	if (!payload || !payload.exp) return true
	const now = Math.floor(Date.now() / 1000)
	return payload.exp < now
}

async function refreshAccessToken() {
	const refresh = getRefreshToken()
	if (!refresh) {
		const err = new Error("Session expired. Please log in again.")
		err.status = 401
		throw err
	}

	const resp = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ refresh }),
	})

	if (!resp.ok) {
		clearTokens()
		const text = await resp.text()
		let payload = null
		try {
			payload = text ? JSON.parse(text) : null
		} catch {
			/* ignore */
		}
		const err = new Error(
			(payload && (payload.detail || payload.message)) || "Unable to refresh session. Please log in again.",
		)
		err.status = resp.status
		err.body = payload
		throw err
	}

	const data = await resp.json()
	const newAccess = data.access || data.access_token
	const newRefresh = data.refresh || data.refresh_token || refresh
	setTokens(newAccess, newRefresh)
	return newAccess
}

export async function apiFetch(path, options = {}) {
	const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`
	const headers = new Headers(options.headers || {})

	if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
		headers.set("Content-Type", "application/json")
	}



	let token = getBrowserToken()
	console.log('token', token);

	// Validate token before sending
	if (token) {
		if (isTokenExpired(token)) {
			try {
				token = await refreshAccessToken()
			} catch (err) {
				clearTokens()
				throw err
			}
		}
		if (!headers.has("Authorization")) {
			headers.set("Authorization", `Bearer ${token}`)
		}
	}

	const response = await fetch(url, {
		...options,
		headers,
	}).catch(err => {
		if (err.message === "Failed to fetch") {
			throw new Error("Cannot connect to the backend server. Please ensure your Django server is running on port 8000.")
		}
		throw err
	})

	if (response.status === 204) {
		return null
	}

	if (!response.ok) {
		let payload = null
		const text = await response.text()
		if (text) {
			try {
				payload = JSON.parse(text)
			} catch (error) {
				// fall through
			}
		}

		// Auto-handle invalid/expired tokens with refresh + retry
		if ((response.status === 401 || response.status === 403) && !options._retry) {
			try {
				const newToken = await refreshAccessToken()
				const retryHeaders = new Headers(headers)
				retryHeaders.set("Authorization", `Bearer ${newToken}`)
				return await apiFetch(path, { ...options, headers: retryHeaders, _retry: true })
			} catch (refreshErr) {
				clearTokens()
				// If refresh failed and we're in the browser, redirect to login
				if (typeof window !== "undefined") {
					const alreadyRedirecting = sessionStorage.getItem("lifesaver:auth_redirecting") === "1"
					const onAuthPage = window.location.pathname.startsWith("/auth")

					if (onAuthPage || alreadyRedirecting) {
						// Return a pending promise that never resolves to avoid throwing 
						// while we are already redirecting or on the login page.
						return new Promise(() => { });
					}

					const isHospitalPage = window.location.pathname.includes("/hospital")
					sessionStorage.setItem("lifesaver:auth_redirecting", "1")
					window.location.href = `/auth/login?module=${isHospitalPage ? "hospital" : "donor"}`
					return new Promise(() => { });
				}
				throw refreshErr
			}
		}

		console.error(`apiFetch failed: ${url} [${response.status}]`, payload)

		const error = new Error(
			(payload && (payload.detail || payload.message)) || `Request failed with status ${response.status}`,
		)
		error.status = response.status
		error.body = payload
		throw error
	}

	if (options.responseAs === "blob") {
		return response.blob()
	}

	let payload = null
	const text = await response.text()
	if (text) {
		try {
			payload = JSON.parse(text)
		} catch (error) {
			// fall through - returning text if not JSON
			return text
		}
	}

	return payload

	return payload
}

