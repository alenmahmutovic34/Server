package com.example.musicroom

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import android.content.SharedPreferences

class MainActivity : AppCompatActivity() {
    private lateinit var sharedPreferences: SharedPreferences

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Provera poslednje aktivnosti
        sharedPreferences = getSharedPreferences("MusicRoomPrefs", MODE_PRIVATE)
        val lastScreen = sharedPreferences.getString("last_screen", "MainActivity")
        if (lastScreen == "Home") {
            startActivity(Intent(this, Home::class.java))
            finish()
        }

        // Povezivanje sa elementima iz layout-a
        val usernameEditText = findViewById<EditText>(R.id.usernameEditText)
        val passwordEditText = findViewById<EditText>(R.id.passwordEditText)
        val loginButton = findViewById<Button>(R.id.loginButton)

        // Klik na dugme za prijavu
        loginButton.setOnClickListener {
            val username = usernameEditText.text.toString()
            val password = passwordEditText.text.toString()

            if (username.isNotEmpty() && password.isNotEmpty()) {
                // Provera za validaciju (možete dodati logiku)
                if (username == "Alen" && password == "1234") { // Primer validacije
                    // Čuvanje poslednje aktivnosti
                    val editor = sharedPreferences.edit()
                    editor.putString("last_screen", "Home")
                    editor.apply()

                    // Navigacija na HomeActivity
                    startActivity(Intent(this, Home::class.java))
                    finish()
                } else {
                    Toast.makeText(this, "Invalid credentials!", Toast.LENGTH_SHORT).show()
                }
            } else {
                Toast.makeText(this, "Please enter username and password", Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onPause() {
        super.onPause()
        val editor = sharedPreferences.edit()
        editor.putString("last_screen", "MainActivity")
        editor.apply()
    }
}
