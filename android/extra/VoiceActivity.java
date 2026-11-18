package bond.sahbi.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

// Si apre quando l'utente tiene premuto il bottone di un auricolare / portachiavi Bluetooth
// (VOICE_COMMAND) o il tasto assistente del telefono (ASSIST): apre Sahbi direttamente in modalità voce.
public class VoiceActivity extends Activity {
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.sahbi.bond/?action=voice&source=android"));
        i.setClass(this, LauncherActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(i);
        finish();
    }
}
