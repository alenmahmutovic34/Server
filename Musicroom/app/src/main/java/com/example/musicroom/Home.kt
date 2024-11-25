package com.example.musicroom

import androidx.appcompat.app.AppCompatActivity
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.content.SharedPreferences

class Home : AppCompatActivity() {
    private lateinit var sharedPreferences: SharedPreferences

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_home)

        // Inicijalizacija SharedPreferences
        sharedPreferences = getSharedPreferences("MusicRoomPrefs", MODE_PRIVATE)

        // Preuzmite sačuvane podatke
        val welcomeText = findViewById<TextView>(R.id.welcome_text)
        val savedText = sharedPreferences.getString("welcome_message", "WELCOME BACK, ALEN!")
        welcomeText.text = savedText

        // Dugme za promenu poruke
        val changeMessageButton = findViewById<Button>(R.id.create_room_button)
        changeMessageButton.setOnClickListener {
            // Menja poruku i čuva je
            val newMessage = "Hello, you created a new room!"
            welcomeText.text = newMessage
            saveState("welcome_message", newMessage)
        }
    }

    // Funkcija za čuvanje stanja u SharedPreferences
    private fun saveState(key: String, value: String) {
        val editor = sharedPreferences.edit()
        editor.putString(key, value)
        editor.apply()
    }
}
