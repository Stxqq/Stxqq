package de.stxqq.jewel;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Opens the player on the live phone CD when a phone connects over Bluetooth. */
public class PhoneConnectedReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Intent open = new Intent(context, MainActivity.class)
                .setAction(MainActivity.ACTION_PHONE)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        try {
            context.startActivity(open);
        } catch (Exception ignored) {
        }
    }
}
