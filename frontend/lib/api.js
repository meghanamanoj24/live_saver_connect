const DEFAULT_API_BASE_URL = "http://localhost:8000/api"

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL

function getBrowserToken() {
	if (typeof window === "undefined") {
		return null
	}
	return localStorage.getItem("accessToken")
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

	if (!headers.has("Content-Type") && options.body) {
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
	})

	if (response.status === 204) {
		return null
	}

	let payload = null
	const text = await response.text()
	if (text) {
		try {
			payload = JSON.parse(text)
		} catch (error) {
			// fall through - payload remains null for non-JSON responses
		}
	}

	if (!response.ok) {
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
					if (!onAuthPage && !alreadyRedirecting) {
						sessionStorage.setItem("lifesaver:auth_redirecting", "1")
						window.location.href = "/auth/login?module=donor"
						return
					}
				}
				throw refreshErr
			}
		}

		console.log(url, 'failed url')

		const error = new Error(
			(payload && (payload.detail || payload.message)) || `Request failed with status ${response.status}`,
		)
		error.status = response.status
		error.body = payload
		throw error
	}

	return payload
}

