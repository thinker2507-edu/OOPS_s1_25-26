using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;

// The launcher owns the only job handle. Windows closes it on terminal/launcher
// termination and kills this application's processes, even without a finally block.
public sealed class RelayForegroundProcess : IDisposable
{
    private IntPtr job;
    public Process Child { get; private set; }

    [StructLayout(LayoutKind.Sequential)]
    private struct BasicLimits
    {
        public long ProcessTime, JobTime;
        public uint Flags;
        public UIntPtr MinimumWorkingSet, MaximumWorkingSet;
        public uint ActiveProcesses;
        public UIntPtr Affinity;
        public uint Priority, Scheduling;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct IoCounters
    {
        public ulong ReadOperations, WriteOperations, OtherOperations;
        public ulong ReadBytes, WriteBytes, OtherBytes;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct ExtendedLimits
    {
        public BasicLimits Basic;
        public IoCounters Io;
        public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetInformationJobObject(IntPtr handle, int kind, ref ExtendedLimits limits, uint size);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool AssignProcessToJobObject(IntPtr handle, IntPtr process);
    [DllImport("kernel32.dll")]
    private static extern bool CloseHandle(IntPtr handle);

    public RelayForegroundProcess(string executable, string script, string directory)
    {
        job = CreateJobObject(IntPtr.Zero, null);
        if (job == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
        try
        {
            var limits = new ExtendedLimits();
            limits.Basic.Flags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            if (!SetInformationJobObject(job, 9, ref limits, (uint)Marshal.SizeOf(limits)))
                throw new Win32Exception(Marshal.GetLastWin32Error());
            Child = Process.Start(new ProcessStartInfo(executable, "\"" + script + "\"") {
                WorkingDirectory = directory, UseShellExecute = false, CreateNoWindow = false
            });
            if (!AssignProcessToJobObject(job, Child.Handle))
            {
                int error = Marshal.GetLastWin32Error();
                if (!Child.HasExited) { Child.Kill(); Child.WaitForExit(); }
                throw new Win32Exception(error, "Cannot attach Relay to its terminal; startup was cancelled.");
            }
        }
        catch { Dispose(); throw; }
    }

    public void Dispose()
    {
        if (job != IntPtr.Zero) { CloseHandle(job); job = IntPtr.Zero; }
        if (Child != null) { Child.Dispose(); Child = null; }
    }
}
