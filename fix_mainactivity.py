import os, glob

# Zoek MainActivity.java
base = r'C:\Users\pepperop\Projects\europoi\android'
pattern = os.path.join(base, '**', 'MainActivity.java')
matches = glob.glob(pattern, recursive=True)

if not matches:
    print("FOUT: MainActivity.java niet gevonden")
    exit()

path = matches[0]
print(f"Gevonden: {path}")

with open(path, encoding='utf-8') as f:
    content = f.read()

print("Huidige inhoud:")
print(content)
print()

# Vervang de standaard MainActivity met een versie die immersive mode ondersteunt
new_content = '''package com.pdrukker.europoi;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        hideSystemBars();
    }

    @Override
    protected void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemBars();
        }
    }

    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 11+ (API 30+)
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                );
            }
        } else {
            // Android 10 en ouder
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
            );
        }
    }
}
'''

with open(path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("OK - MainActivity.java bijgewerkt met immersive mode")
print()
print("Huidige package naam in nieuw bestand: com.pdrukker.europoi")
print("Controleer of dit overeenkomt met jouw app ID in capacitor.config.js")
