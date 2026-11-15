import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/common/Button';
import axios from 'axios';
import { SERVER_BASE_URL as API_BASE_URL } from '../services/api';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleForgotPassword = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/auth/forgot-password`, { email });
      setMessage('若该邮箱已注册，密码重置邮件已发送至您的邮箱，请查收。');
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || '发送失败，请稍后重试。');
      setMessage('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          找回 / 重置密码
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          输入您注册时的邮箱地址，我们将向您发送重置密码的邮件链接。
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="space-y-6">
            {error && <p className="text-red-500 text-center">{error}</p>}
            {message && <p className="text-green-500 text-center">{message}</p>}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                注册邮箱地址
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="yourname@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                />
              </div>
            </div>

            <div>
              <Button variant="gradient" className="w-full py-2.5 font-bold" onClick={handleForgotPassword}>
                发送密码重置邮件
              </Button>
            </div>

            <div className="text-sm text-center">
                <Link to="/login" className="font-medium text-purple-600 hover:text-purple-500">
                  返回登录页面
                </Link>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;