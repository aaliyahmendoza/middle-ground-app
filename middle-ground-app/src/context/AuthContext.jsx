import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.me()
      .then(data => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await api.login({ email, password });
    setUser(data.user);
    return data;
  };

  const register = async (name, email, password, phone) => {
    const data = await api.register({ name, email, password, phone });
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  const verifyPhone = async (code) => {
    await api.verifyPhone(code);
    setUser(prev => prev ? { ...prev, phone_verified: 1 } : null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, verifyPhone, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
