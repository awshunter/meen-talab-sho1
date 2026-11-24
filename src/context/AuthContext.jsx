import React, { createContext, useState, useEffect } from 'react';
import { loginUser, fetchCurrentUser, logoutUser } from '../services/authService';

export const AuthContext = createContext(null);

const TOKEN_KEY = 'meen_talab_sho_token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY));
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const verifySession = async () => {
      const savedToken = sessionStorage.getItem(TOKEN_KEY);
      
      if (!savedToken) {
        setUser(null);
        setToken(null);
        setIsCheckingAuth(false);
        return;
      }

      try {
        const data = await fetchCurrentUser(savedToken);
        const currentUser = data.user || data;
        setUser(currentUser);
        setToken(savedToken);
      } catch (err) {
        
       
        sessionStorage.removeItem(TOKEN_KEY);
        setUser(null);
        setToken(null);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    verifySession();
  }, []);

  const login = async (email, password) => {
    const data = await loginUser({ email, password });
    const receivedToken = data.token;
    const receivedUser = data.user;

    sessionStorage.setItem(TOKEN_KEY, receivedToken);
    setToken(receivedToken);
    setUser(receivedUser);

    return receivedUser;
  };

  const logout = async () => {
    const currentToken = sessionStorage.getItem(TOKEN_KEY) || token;
    let logoutWaring = "";

   try {
      if (currentToken) {
        await logoutUser(currentToken);
      }
    } catch {
      logoutWarning = 'تم تسجيل الخروج محلياً، لكن تعذّر إلغاء الجلسة على السيرفر.';
    } finally {
      sessionStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    }

    return { logoutWarning };
  };

  const value = {
    user,
    token,
    isAuthenticated: Boolean(user && token),
    isCheckingAuth,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}