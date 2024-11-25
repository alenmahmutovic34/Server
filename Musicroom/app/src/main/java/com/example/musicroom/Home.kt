package com.example.musicroom

import android.os.Bundle
import android.view.LayoutInflater
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity

class Home : AppCompatActivity() {
    private var isCreateRoomDialogOpen = false
    private var isJoinRoomDialogOpen = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_home)

        // Vraćanje stanja dijaloga ako je aplikacija ponovo kreirana
        if (savedInstanceState != null) {
            isCreateRoomDialogOpen = savedInstanceState.getBoolean("isCreateRoomDialogOpen", false)
            isJoinRoomDialogOpen = savedInstanceState.getBoolean("isJoinRoomDialogOpen", false)

            if (isCreateRoomDialogOpen) {
                showCreateRoomDialog()
            }

            if (isJoinRoomDialogOpen) {
                showJoinRoomDialog()
            }
        }

        // Dugme za kreiranje sobe
        val createRoomButton = findViewById<Button>(R.id.create_room_button)
        createRoomButton.setOnClickListener {
            isCreateRoomDialogOpen = true
            showCreateRoomDialog()
        }

        // Dugme za pridruživanje sobi
        val joinRoomButton = findViewById<Button>(R.id.join_room_button)
        joinRoomButton.setOnClickListener {
            isJoinRoomDialogOpen = true
            showJoinRoomDialog()
        }
    }

    // Prikaz dijaloga za kreiranje sobe
    private fun showCreateRoomDialog() {
        val dialogView = LayoutInflater.from(this).inflate(R.layout.create_room, null)
        val roomNameInput = dialogView.findViewById<EditText>(R.id.room_name_input)
        val roomCapacityInput = dialogView.findViewById<EditText>(R.id.room_capacity_input)

        val dialog = AlertDialog.Builder(this)
            .setTitle("Create a Room")
            .setView(dialogView)
            .setPositiveButton("Create") { _, _ ->
                isCreateRoomDialogOpen = false
                val roomName = roomNameInput.text.toString()
                val roomCapacity = roomCapacityInput.text.toString()

                if (roomName.isNotBlank() && roomCapacity.isNotBlank()) {
                    Toast.makeText(
                        this,
                        "Room Created: $roomName with capacity $roomCapacity",
                        Toast.LENGTH_SHORT
                    ).show()
                } else {
                    Toast.makeText(this, "Please fill in all fields", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Cancel") { dialog, _ ->
                isCreateRoomDialogOpen = false
                dialog.dismiss()
            }
            .create()

        dialog.setOnDismissListener {
            isCreateRoomDialogOpen = false
        }

        dialog.show()
    }

    // Prikaz dijaloga za pridruživanje sobi
    private fun showJoinRoomDialog() {
        val dialogView = LayoutInflater.from(this).inflate(R.layout.join_room, null)
        val roomCodeInput = dialogView.findViewById<EditText>(R.id.room_code_input)

        val dialog = AlertDialog.Builder(this)
            .setTitle("Join a Room")
            .setView(dialogView)
            .setPositiveButton("Join") { _, _ ->
                isJoinRoomDialogOpen = false
                val roomCode = roomCodeInput.text.toString()

                if (roomCode.isNotBlank()) {
                    Toast.makeText(this, "Joining Room with code: $roomCode", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this, "Please enter a valid room code", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Cancel") { dialog, _ ->
                isJoinRoomDialogOpen = false
                dialog.dismiss()
            }
            .create()

        dialog.setOnDismissListener {
            isJoinRoomDialogOpen = false
        }

        dialog.show()
    }

    // Čuvanje stanja dijaloga pri promeni orijentacije
    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putBoolean("isCreateRoomDialogOpen", isCreateRoomDialogOpen)
        outState.putBoolean("isJoinRoomDialogOpen", isJoinRoomDialogOpen)
    }
}
