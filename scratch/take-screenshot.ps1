Add-Type -AssemblyName System.Windows.Forms,System.Drawing
$screens = [System.Windows.Forms.Screen]::AllScreens
$bounds = $screens[0].Bounds
$bmp = New-Object System.Drawing.Bitmap $bounds.width, $bounds.height
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.size)
$bmp.Save("C:\Users\PRANAV\.gemini\antigravity-ide\brain\2390ccca-9c0c-42ba-9f14-bf91bb85eecf\electron_screenshot.png")
$graphics.Dispose()
$bmp.Dispose()
