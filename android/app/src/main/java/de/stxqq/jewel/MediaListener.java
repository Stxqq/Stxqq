package de.stxqq.jewel;

import android.service.notification.NotificationListenerService;

/**
 * Empty on purpose. Android only lets an app read other apps' media sessions
 * (title, artist, cover, play state) while the user has granted it notification
 * access, and that grant is tied to a NotificationListenerService.
 */
public class MediaListener extends NotificationListenerService {
}
