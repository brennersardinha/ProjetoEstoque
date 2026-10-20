using System;
using System.Diagnostics;
using System.IO;

internal static class WindowsLauncher
{
    private static int Main()
    {
        var root = AppDomain.CurrentDomain.BaseDirectory;
        var script = Path.Combine(root, "scripts", "iniciar-estoque.ps1");
        var startInfo = new ProcessStartInfo
        {
            FileName = "powershell.exe",
            Arguments = "-NoProfile -ExecutionPolicy Bypass -File \"" + script + "\"",
            WorkingDirectory = root,
            UseShellExecute = false,
            CreateNoWindow = false
        };

        try
        {
            using (var process = Process.Start(startInfo))
            {
                process.WaitForExit();
                return process.ExitCode;
            }
        }
        catch (Exception exception)
        {
            Console.Error.WriteLine("Não foi possível iniciar o sistema: " + exception.Message);
            return 1;
        }
    }
}
