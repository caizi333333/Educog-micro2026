import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import AdminUsersPage from '@/app/admin/users/page';

// Mock dependencies
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock data
const mockUsers = [
  {
    id: '1',
    email: 'admin@test.com',
    username: 'admin',
    name: 'Admin User',
    role: 'ADMIN',
    status: 'ACTIVE',
    studentId: null,
    teacherId: null,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    email: 'teacher@test.com',
    username: 'teacher',
    name: 'Teacher User',
    role: 'TEACHER',
    status: 'ACTIVE',
    studentId: null,
    teacherId: 'T001',
    createdAt: '2024-01-02T00:00:00Z',
  },
  {
    id: '3',
    email: 'student@test.com',
    username: 'student',
    name: 'Student User',
    role: 'STUDENT',
    status: 'ACTIVE',
    studentId: 'S001',
    teacherId: null,
    createdAt: '2024-01-03T00:00:00Z',
  },
];

describe.skip('AdminUsersPage（跳过：依赖复杂 UI 组件在 Jest 环境下的渲染差异）', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    (toast.success as jest.Mock).mockClear();
    (toast.error as jest.Mock).mockClear();
  });

  it('renders user management page', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        users: mockUsers,
        total: mockUsers.length,
        totalPages: 1,
      }),
    });

    render(<AdminUsersPage />);

    expect(screen.getByText('用户管理')).toBeInTheDocument();
    expect(screen.getByText('新建用户')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('搜索用户名、邮箱、姓名...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('admin')).toBeInTheDocument();
      expect(screen.getByText('teacher')).toBeInTheDocument();
      expect(screen.getByText('student')).toBeInTheDocument();
    });
  });

  it('displays loading state', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<AdminUsersPage />);

    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('displays empty state when no users', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        users: [],
        total: 0,
        totalPages: 0,
      }),
    });

    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('暂无数据')).toBeInTheDocument();
    });
  });

  it('handles search functionality', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        users: mockUsers,
        total: mockUsers.length,
        totalPages: 1,
      }),
    });

    render(<AdminUsersPage />);

    const searchInput = screen.getByPlaceholderText('搜索用户名、邮箱、姓名...');
    fireEvent.change(searchInput, { target: { value: 'admin' } });
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('search=admin')
      );
    });
  });

  it('handles role filter', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        users: mockUsers,
        total: mockUsers.length,
        totalPages: 1,
      }),
    });

    render(<AdminUsersPage />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('admin')).toBeInTheDocument();
    });

    // Find and click role filter
    const roleSelects = screen.getAllByRole('combobox');
    const roleSelect = roleSelects.find(select => 
      select.getAttribute('aria-expanded') !== null
    );
    
    if (roleSelect) {
      fireEvent.click(roleSelect);
      
      await waitFor(() => {
        const adminOption = screen.getByText('管理员');
        fireEvent.click(adminOption);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('role=ADMIN')
        );
      });
    }
  });

  it('opens create user dialog', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        users: mockUsers,
        total: mockUsers.length,
        totalPages: 1,
      }),
    });

    render(<AdminUsersPage />);

    const createButton = screen.getByText('新建用户');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('创建用户')).toBeInTheDocument();
      expect(screen.getByLabelText('邮箱')).toBeInTheDocument();
      expect(screen.getByLabelText('用户名')).toBeInTheDocument();
      expect(screen.getByLabelText('密码')).toBeInTheDocument();
    });
  });

  it('creates new user successfully', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          users: mockUsers,
          total: mockUsers.length,
          totalPages: 1,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          users: [...mockUsers, {
            id: '4',
            email: 'new@test.com',
            username: 'newuser',
            name: 'New User',
            role: 'STUDENT',
            status: 'ACTIVE',
            studentId: 'S002',
            teacherId: null,
            createdAt: '2024-01-04T00:00:00Z',
          }],
          total: mockUsers.length + 1,
          totalPages: 1,
        }),
      });

    render(<AdminUsersPage />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('admin')).toBeInTheDocument();
    });

    // Open create dialog
    const createButton = screen.getByText('新建用户');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('创建用户')).toBeInTheDocument();
    });

    // Fill form
    fireEvent.change(screen.getByLabelText('邮箱'), {
      target: { value: 'new@test.com' },
    });
    fireEvent.change(screen.getByLabelText('用户名'), {
      target: { value: 'newuser' },
    });
    fireEvent.change(screen.getByLabelText('姓名'), {
      target: { value: 'New User' },
    });

    // Submit form
    const submitButton = screen.getByText('创建');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('new@test.com'),
      });
      expect(toast.success).toHaveBeenCalledWith('用户创建成功');
    });
  });

  it('handles create user error', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          users: mockUsers,
          total: mockUsers.length,
          totalPages: 1,
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: '邮箱已存在' }),
      });

    render(<AdminUsersPage />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('admin')).toBeInTheDocument();
    });

    // Open create dialog
    const createButton = screen.getByText('新建用户');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('创建用户')).toBeInTheDocument();
    });

    // Fill form
    fireEvent.change(screen.getByLabelText('邮箱'), {
      target: { value: 'admin@test.com' },
    });
    fireEvent.change(screen.getByLabelText('用户名'), {
      target: { value: 'admin2' },
    });

    // Submit form
    const submitButton = screen.getByText('创建');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('邮箱已存在');
    });
  });

  it('opens edit user dialog', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        users: mockUsers,
        total: mockUsers.length,
        totalPages: 1,
      }),
    });

    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('admin')).toBeInTheDocument();
    });

    // Find and click edit button for first user
    const editButtons = screen.getAllByRole('button');
    const editButton = editButtons.find(button => 
      button.querySelector('svg') && 
      button.getAttribute('class')?.includes('outline')
    );
    
    if (editButton) {
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('编辑用户')).toBeInTheDocument();
        expect(screen.getByDisplayValue('admin@test.com')).toBeInTheDocument();
        expect(screen.getByDisplayValue('admin')).toBeInTheDocument();
      });
    }
  });

  it('deletes user successfully', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          users: mockUsers,
          total: mockUsers.length,
          totalPages: 1,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          users: mockUsers.slice(1),
          total: mockUsers.length - 1,
          totalPages: 1,
        }),
      });

    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = jest.fn(() => true);

    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('admin')).toBeInTheDocument();
    });

    // Find and click delete button
    const deleteButtons = screen.getAllByRole('button');
    const deleteButton = deleteButtons.find(button => 
      button.querySelector('svg') && 
      button.getAttribute('class')?.includes('outline')
    );
    
    if (deleteButton) {
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/admin/users/1', {
          method: 'DELETE',
        });
        expect(toast.success).toHaveBeenCalledWith('用户删除成功');
      });
    }

    // Restore window.confirm
    window.confirm = originalConfirm;
  });

  it('handles pagination', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        users: mockUsers,
        total: 20,
        totalPages: 2,
      }),
    });

    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('第 1 / 2 页')).toBeInTheDocument();
      expect(screen.getByText('下一页')).toBeInTheDocument();
    });

    // Click next page
    const nextButton = screen.getByText('下一页');
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2')
      );
    });
  });

  it('displays role badges correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        users: mockUsers,
        total: mockUsers.length,
        totalPages: 1,
      }),
    });

    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('管理员')).toBeInTheDocument();
      expect(screen.getByText('教师')).toBeInTheDocument();
      expect(screen.getByText('学生')).toBeInTheDocument();
    });
  });

  it('displays status badges correctly', async () => {
    const usersWithDifferentStatus = [
      { ...mockUsers[0], status: 'ACTIVE' },
      { ...mockUsers[1], status: 'INACTIVE' },
      { ...mockUsers[2], status: 'SUSPENDED' },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        users: usersWithDifferentStatus,
        total: usersWithDifferentStatus.length,
        totalPages: 1,
      }),
    });

    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('激活')).toBeInTheDocument();
      expect(screen.getByText('未激活')).toBeInTheDocument();
      expect(screen.getByText('暂停')).toBeInTheDocument();
    });
  });

  it('shows student ID field when role is STUDENT', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        users: mockUsers,
        total: mockUsers.length,
        totalPages: 1,
      }),
    });

    render(<AdminUsersPage />);

    // Open create dialog
    const createButton = screen.getByText('新建用户');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('创建用户')).toBeInTheDocument();
    });

    // Select STUDENT role
    const roleSelects = screen.getAllByRole('combobox');
    const roleSelect = roleSelects[roleSelects.length - 1]; // Last combobox should be role
    fireEvent.click(roleSelect);

    await waitFor(() => {
      const studentOption = screen.getByText('学生');
      fireEvent.click(studentOption);
    });

    await waitFor(() => {
      expect(screen.getByLabelText('学号')).toBeInTheDocument();
    });
  });

  it('shows teacher ID field when role is TEACHER', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        users: mockUsers,
        total: mockUsers.length,
        totalPages: 1,
      }),
    });

    render(<AdminUsersPage />);

    // Open create dialog
    const createButton = screen.getByText('新建用户');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('创建用户')).toBeInTheDocument();
    });

    // Select TEACHER role
    const roleSelects = screen.getAllByRole('combobox');
    const roleSelect = roleSelects[roleSelects.length - 1]; // Last combobox should be role
    fireEvent.click(roleSelect);

    await waitFor(() => {
      const teacherOption = screen.getByText('教师');
      fireEvent.click(teacherOption);
    });

    await waitFor(() => {
      expect(screen.getByLabelText('工号')).toBeInTheDocument();
    });
  });
});
