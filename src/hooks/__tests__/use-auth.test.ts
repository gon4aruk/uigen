import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

describe("useAuth", () => {
  const mockPush = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useRouter as any).mockReturnValue({ push: mockPush });
    (getAnonWorkData as any).mockReturnValue(null);
    (getProjects as any).mockResolvedValue([]);
    (createProject as any).mockResolvedValue({ id: "new-project-id" });
  });

  describe("initial state", () => {
    test("starts with isLoading false", () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(false);
    });

    test("exposes signIn, signUp, and isLoading", () => {
      const { result } = renderHook(() => useAuth());

      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("signIn", () => {
    test("sets isLoading true while in flight and false when done", async () => {
      let resolveSignIn: (value: any) => void;
      (signInAction as any).mockReturnValue(
        new Promise((resolve) => {
          resolveSignIn = resolve;
        })
      );

      const { result } = renderHook(() => useAuth());

      let signInPromise: Promise<any>;
      act(() => {
        signInPromise = result.current.signIn("test@example.com", "password123");
      });

      await waitFor(() => expect(result.current.isLoading).toBe(true));

      await act(async () => {
        resolveSignIn!({ success: true });
        await signInPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("redirects to a new project built from anonymous work on success", async () => {
      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue({
        messages: [{ id: "1", role: "user", content: "hi" }],
        fileSystemData: { "/App.jsx": { type: "file", content: "" } },
      });
      (createProject as any).mockResolvedValue({ id: "anon-project-id" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ id: "1", role: "user", content: "hi" }],
          data: { "/App.jsx": { type: "file", content: "" } },
        })
      );
      expect(clearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
      expect(getProjects).not.toHaveBeenCalled();
    });

    test("ignores anonymous work with no messages and falls back to existing projects", async () => {
      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue({
        messages: [],
        fileSystemData: {},
      });
      (getProjects as any).mockResolvedValue([{ id: "existing-project-id" }]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(createProject).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/existing-project-id");
    });

    test("redirects to most recent project when no anonymous work exists", async () => {
      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([
        { id: "recent-project-id" },
        { id: "older-project-id" },
      ]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/recent-project-id");
      expect(createProject).not.toHaveBeenCalled();
    });

    test("creates a new project when the user has none and no anonymous work exists", async () => {
      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([]);
      (createProject as any).mockResolvedValue({ id: "brand-new-id" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({ messages: [], data: {} })
      );
      expect(mockPush).toHaveBeenCalledWith("/brand-new-id");
    });

    test("does not redirect or touch projects when credentials are invalid", async () => {
      (signInAction as any).mockResolvedValue({
        success: false,
        error: "Invalid credentials",
      });

      const { result } = renderHook(() => useAuth());

      let response: any;
      await act(async () => {
        response = await result.current.signIn("test@example.com", "wrong");
      });

      expect(response).toEqual({ success: false, error: "Invalid credentials" });
      expect(mockPush).not.toHaveBeenCalled();
      expect(getProjects).not.toHaveBeenCalled();
      expect(createProject).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });

    test("returns the result from the sign in action", async () => {
      (signInAction as any).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());

      let response: any;
      await act(async () => {
        response = await result.current.signIn("test@example.com", "password123");
      });

      expect(response).toEqual({ success: true });
    });

    test("resets isLoading even when the sign in action throws", async () => {
      (signInAction as any).mockRejectedValue(new Error("network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await expect(
          result.current.signIn("test@example.com", "password123")
        ).rejects.toThrow("network error");
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("calls the sign in action with the given credentials", async () => {
      (signInAction as any).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(signInAction).toHaveBeenCalledWith(
        "test@example.com",
        "password123"
      );
    });
  });

  describe("signUp", () => {
    test("redirects to a new project built from anonymous work on success", async () => {
      (signUpAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue({
        messages: [{ id: "1", role: "user", content: "hi" }],
        fileSystemData: { "/App.jsx": { type: "file", content: "" } },
      });
      (createProject as any).mockResolvedValue({ id: "anon-project-id" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(clearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
    });

    test("does not redirect when sign up fails", async () => {
      (signUpAction as any).mockResolvedValue({
        success: false,
        error: "Email already registered",
      });

      const { result } = renderHook(() => useAuth());

      let response: any;
      await act(async () => {
        response = await result.current.signUp("new@example.com", "password123");
      });

      expect(response).toEqual({
        success: false,
        error: "Email already registered",
      });
      expect(mockPush).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });

    test("creates a new project when the user has none and no anonymous work exists", async () => {
      (signUpAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([]);
      (createProject as any).mockResolvedValue({ id: "brand-new-id" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/brand-new-id");
    });

    test("calls the sign up action with the given credentials", async () => {
      (signUpAction as any).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(signUpAction).toHaveBeenCalledWith(
        "new@example.com",
        "password123"
      );
    });

    test("resets isLoading even when the sign up action throws", async () => {
      (signUpAction as any).mockRejectedValue(new Error("network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await expect(
          result.current.signUp("new@example.com", "password123")
        ).rejects.toThrow("network error");
      });

      expect(result.current.isLoading).toBe(false);
    });
  });
});
