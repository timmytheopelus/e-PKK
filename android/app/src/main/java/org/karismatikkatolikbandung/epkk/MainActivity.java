package org.karismatikkatolikbandung.epkk;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import androidx.browser.customtabs.CustomTabColorSchemeParams;
import androidx.browser.customtabs.CustomTabsIntent;

/** Pintasan: membuka e-PKK di Chrome (login Google berjalan normal), lalu menutup dirinya sendiri. */
public class MainActivity extends Activity {
    private static final String URL = "https://e-pkk-one.vercel.app/";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Uri uri = Uri.parse(URL);
        try {
            CustomTabsIntent tab = new CustomTabsIntent.Builder()
                    .setDefaultColorSchemeParams(new CustomTabColorSchemeParams.Builder().setToolbarColor(0xFF12263A).build())
                    .setShowTitle(true)
                    .build();
            tab.launchUrl(this, uri);
        } catch (ActivityNotFoundException e) {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        }
        finish();
    }
}
