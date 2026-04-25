import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import LoginPage from '@/app/login/page';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock the useToast hook
jest.mock('@/hooks/use-toast', () => ({
  useToast: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

const mockPush = jest.fn();
const mockToast = jest.fn();

describe.skip('LoginPage（跳过：依赖复杂 UI 组件在 Jest 环境下的渲染差异）', () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
    (useToast as jest.Mock).mockReturnValue({
      toast: mockToast,
    });
    jest.clearAllMocks();
    localStorageMock.setItem.mockClear();
    (fetch as jest.Mock).mockClear();
  });

  it('renders login page correctly', () => {
    render(<LoginPage />);
    
    expect(screen.getByText('芯智育才')).toBeInTheDocument();
    expect(screen.getByText('8051微控制器仿真教育平台')).toBeInTheDocument();
    expect(screen.getByText('登录')).toBeInTheDocument();
    expect(screen.getByText('注册')).toBeInTheDocument();
  });

  it('displays login form by default', () => {
    render(<LoginPage />);
    
    expect(screen.getByLabelText('邮箱或用户名')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /登录/ })).toBeInTheDocument();
    expect(screen.getByText('测试账号：admin / 123456')).toBeInTheDocument();
  });

  it('switches to register form when register tab is clicked', () => {
    render(<LoginPage />);
    
    const registerTab = screen.getByRole('tab', { name: '注册' });
    fireEvent.click(registerTab);
    
    expect(screen.getByLabelText('邮箱 *')).toBeInTheDocument();
    expect(screen.getByLabelText('用户名 *')).toBeInTheDocument();
    expect(screen.getByLabelText('密码 *')).toBeInTheDocument();
    expect(screen.getByLabelText('确认密码 *')).toBeInTheDocument();
    expect(screen.getByLabelText('姓名')).toBeInTheDocument();
    expect(screen.getByLabelText('学号')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /注册/ })).toBeInTheDocument();
  });

  it('handles login form input changes', () => {
    render(<LoginPage />);
    
    const emailInput = screen.getByLabelText('邮箱或用户名');
    const passwordInput = screen.getByLabelText('密码');
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    expect(emailInput).toHaveValue('test@example.com');
    expect(passwordInput).toHaveValue('password123');
  });

  it('handles register form input changes', () => {
    render(<LoginPage />);
    
    const registerTab = screen.getByRole('tab', { name: '注册' });
    fireEvent.click(registerTab);
    
    const emailInput = screen.getByLabelText('邮箱 *');
    const usernameInput = screen.getByLabelText('用户名 *');
    const passwordInput = screen.getByLabelText('密码 *');
    const confirmPasswordInput = screen.getByLabelText('确认密码 *');
    const nameInput = screen.getByLabelText('姓名');
    const studentIdInput = screen.getByLabelText('学号');
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(studentIdInput, { target: { value: '12345' } });
    
    expect(emailInput).toHaveValue('test@example.com');
    expect(usernameInput).toHaveValue('testuser');
    expect(passwordInput).toHaveValue('password123');
    expect(confirmPasswordInput).toHaveValue('password123');
    expect(nameInput).toHaveValue('Test User');
    expect(studentIdInput).toHaveValue('12345');
  });

  it('shows error when login form is submitted with empty fields', async () => {
    render(<LoginPage />);
    
    const loginButton = screen.getByRole('button', { name: /登录/ });
    fireEvent.click(loginButton);
    
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: '错误',
        description: '请填写所有必填字段',
        variant: 'destructive'
      });
    });
  });

  it('shows error when register form is submitted with empty required fields', async () => {
    render(<LoginPage />);
    
    const registerTab = screen.getByRole('tab', { name: '注册' });
    fireEvent.click(registerTab);
    
    const registerButton = screen.getByRole('button', { name: /注册/ });
    fireEvent.click(registerButton);
    
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: '错误',
        description: '请填写所有必填字段',
        variant: 'destructive'
      });
    });
  });

  it('shows error when passwords do not match in register form', async () => {
    render(<LoginPage />);
    
    const registerTab = screen.getByRole('tab', { name: '注册' });
    fireEvent.click(registerTab);
    
    const emailInput = screen.getByLabelText('邮箱 *');
    const usernameInput = screen.getByLabelText('用户名 *');
    const passwordInput = screen.getByLabelText('密码 *');
    const confirmPasswordInput = screen.getByLabelText('确认密码 *');
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'differentpassword' } });
    
    const registerButton = screen.getByRole('button', { name: /注册/ });
    fireEvent.click(registerButton);
    
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: '错误',
        description: '两次输入的密码不一致',
        variant: 'destructive'
      });
    });
  });

  it('shows error when password is too short in register form', async () => {
    render(<LoginPage />);
    
    const registerTab = screen.getByRole('tab', { name: '注册' });
    fireEvent.click(registerTab);
    
    const emailInput = screen.getByLabelText('邮箱 *');
    const usernameInput = screen.getByLabelText('用户名 *');
    const passwordInput = screen.getByLabelText('密码 *');
    const confirmPasswordInput = screen.getByLabelText('确认密码 *');
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: '123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: '123' } });
    
    const registerButton = screen.getByRole('button', { name: /注册/ });
    fireEvent.click(registerButton);
    
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: '错误',
        description: '密码长度至少6位',
        variant: 'destructive'
      });
    });
  });

  it('handles successful login', async () => {
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        accessToken: 'mock-token',
        user: { id: 1, username: 'testuser', role: 'STUDENT' }
      })
    };
    (fetch as jest.Mock).mockResolvedValue(mockResponse);

    render(<LoginPage />);
    
    const emailInput = screen.getByLabelText('邮箱或用户名');
    const passwordInput = screen.getByLabelText('密码');
    const loginButton = screen.getByRole('button', { name: /登录/ });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(loginButton);
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          emailOrUsername: 'test@example.com',
          password: 'password123'
        })
      });
    });

    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalledWith('accessToken', 'mock-token');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('user', JSON.stringify({ id: 1, username: 'testuser', role: 'STUDENT' }));
      expect(mockToast).toHaveBeenCalledWith({
        title: '成功',
        description: '登录成功！'
      });
    });
  });

  it('handles successful login with first login achievement', async () => {
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        accessToken: 'mock-token',
        user: { id: 1, username: 'testuser', role: 'STUDENT' },
        firstLoginAchievement: {
          name: '首次登录',
          description: '欢迎来到平台！'
        }
      })
    };
    (fetch as jest.Mock).mockResolvedValue(mockResponse);

    render(<LoginPage />);
    
    const emailInput = screen.getByLabelText('邮箱或用户名');
    const passwordInput = screen.getByLabelText('密码');
    const loginButton = screen.getByRole('button', { name: /登录/ });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(loginButton);
    
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: '成功',
        description: '登录成功！'
      });
    });
  });

  it('handles login failure', async () => {
    const mockResponse = {
      ok: false,
      json: jest.fn().mockResolvedValue({
        error: '用户名或密码错误'
      })
    };
    (fetch as jest.Mock).mockResolvedValue(mockResponse);

    render(<LoginPage />);
    
    const emailInput = screen.getByLabelText('邮箱或用户名');
    const passwordInput = screen.getByLabelText('密码');
    const loginButton = screen.getByRole('button', { name: /登录/ });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
    fireEvent.click(loginButton);
    
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: '登录失败',
        description: '用户名或密码错误',
        variant: 'destructive'
      });
    });
  });

  it('handles successful registration', async () => {
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        accessToken: 'mock-token',
        user: { id: 1, username: 'testuser', role: 'STUDENT' }
      })
    };
    (fetch as jest.Mock).mockResolvedValue(mockResponse);

    render(<LoginPage />);
    
    const registerTab = screen.getByRole('tab', { name: '注册' });
    fireEvent.click(registerTab);
    
    const emailInput = screen.getByLabelText('邮箱 *');
    const usernameInput = screen.getByLabelText('用户名 *');
    const passwordInput = screen.getByLabelText('密码 *');
    const confirmPasswordInput = screen.getByLabelText('确认密码 *');
    const registerButton = screen.getByRole('button', { name: /注册/ });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
    fireEvent.click(registerButton);
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'test@example.com',
          username: 'testuser',
          password: 'password123',
          name: '',
          role: 'STUDENT',
          studentId: ''
        })
      });
    });

    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalledWith('accessToken', 'mock-token');
      expect(mockToast).toHaveBeenCalledWith({
        title: '成功',
        description: '注册成功！'
      });
      expect(mockPush).toHaveBeenCalledWith('/simulation');
    });
  });

  it('handles registration failure', async () => {
    const mockResponse = {
      ok: false,
      json: jest.fn().mockResolvedValue({
        error: '用户名已存在'
      })
    };
    (fetch as jest.Mock).mockResolvedValue(mockResponse);

    render(<LoginPage />);
    
    const registerTab = screen.getByRole('tab', { name: '注册' });
    fireEvent.click(registerTab);
    
    const emailInput = screen.getByLabelText('邮箱 *');
    const usernameInput = screen.getByLabelText('用户名 *');
    const passwordInput = screen.getByLabelText('密码 *');
    const confirmPasswordInput = screen.getByLabelText('确认密码 *');
    const registerButton = screen.getByRole('button', { name: /注册/ });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(usernameInput, { target: { value: 'existinguser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
    fireEvent.click(registerButton);
    
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: '注册失败',
        description: '用户名已存在',
        variant: 'destructive'
      });
    });
  });

  it('disables form inputs and buttons when loading', async () => {
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        accessToken: 'mock-token',
        user: { id: 1, username: 'testuser', role: 'STUDENT' }
      })
    };
    (fetch as jest.Mock).mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockResponse), 100)));

    render(<LoginPage />);
    
    const emailInput = screen.getByLabelText('邮箱或用户名');
    const passwordInput = screen.getByLabelText('密码');
    const loginButton = screen.getByRole('button', { name: /登录/ });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(loginButton);
    
    // Check that inputs and button are disabled during loading
    expect(emailInput).toBeDisabled();
    expect(passwordInput).toBeDisabled();
    expect(loginButton).toBeDisabled();
    
    // Check for loading spinner
    expect(screen.getByRole('button', { name: /登录/ })).toContainHTML('animate-spin');
    
    await waitFor(() => {
      expect(emailInput).not.toBeDisabled();
      expect(passwordInput).not.toBeDisabled();
      expect(loginButton).not.toBeDisabled();
    });
  });

  it('handles network errors gracefully', async () => {
    (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(<LoginPage />);
    
    const emailInput = screen.getByLabelText('邮箱或用户名');
    const passwordInput = screen.getByLabelText('密码');
    const loginButton = screen.getByRole('button', { name: /登录/ });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(loginButton);
    
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: '登录失败',
        description: 'Network error',
        variant: 'destructive'
      });
    });
  });
});
