package com.example.myapplication;

import android.annotation.SuppressLint;
import android.content.Context;
import android.location.Location;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class GPSFetcher {

    private static final String TAG = "GPSFetcher";
    private static final String SERVER_URL = "http://YOUR_SERVER_IP:5000/api/update";
    private static final String DEVICE_ID = "android_" + android.os.Build.SERIAL;
    private static final String VEHICLE_TYPE = "CAR";
    private static final long UPDATE_INTERVAL_MS = 2000;

    private final Context context;
    private final FusedLocationProviderClient fusedClient;
    private final ExecutorService networkExecutor;
    private final Handler mainHandler;
    private LocationCallback locationCallback;
    private Location lastLocation;

    public GPSFetcher(Context context) {
        this.context = context;
        this.fusedClient = LocationServices.getFusedLocationProviderClient(context);
        this.networkExecutor = Executors.newSingleThreadExecutor();
        this.mainHandler = new Handler(Looper.getMainLooper());
    }

    @SuppressLint("MissingPermission")
    public void startGettingLocations() {
        LocationRequest request = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, UPDATE_INTERVAL_MS)
                .setMinUpdateIntervalMillis(1000)
                .build();

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult result) {
                Location location = result.getLastLocation();
                if (location == null) return;

                double speed = location.hasSpeed() ? location.getSpeed() * 3.6 : estimateSpeed(location);
                lastLocation = location;

                sendToServer(location.getLatitude(), location.getLongitude(), speed);
            }
        };

        fusedClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper());
        Log.d(TAG, "Location updates started");
    }

    public void stopGettingLocations() {
        if (locationCallback != null) {
            fusedClient.removeLocationUpdates(locationCallback);
            Log.d(TAG, "Location updates stopped");
        }
        networkExecutor.shutdown();
    }

    private double estimateSpeed(Location current) {
        if (lastLocation == null) return 0;
        float distance = lastLocation.distanceTo(current);
        long timeDelta = (current.getTime() - lastLocation.getTime()) / 1000;
        if (timeDelta <= 0) return 0;
        return (distance / timeDelta) * 3.6;
    }

    private void sendToServer(double lat, double lng, double velocity) {
        networkExecutor.execute(() -> {
            try {
                JSONObject payload = new JSONObject();
                payload.put("id", DEVICE_ID);
                payload.put("lat", lat);
                payload.put("lng", lng);
                payload.put("x", lat * 1000 % 200);
                payload.put("y", lng * 1000 % 200);
                payload.put("velocity", velocity);
                payload.put("vehicle_type", VEHICLE_TYPE);

                URL url = new URL(SERVER_URL);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);

                byte[] body = payload.toString().getBytes(StandardCharsets.UTF_8);
                OutputStream os = conn.getOutputStream();
                os.write(body);
                os.flush();
                os.close();

                int responseCode = conn.getResponseCode();
                Log.d(TAG, "Server response: " + responseCode);

                conn.disconnect();
            } catch (Exception e) {
                Log.e(TAG, "Failed to send location: " + e.getMessage());
            }
        });
    }
}
