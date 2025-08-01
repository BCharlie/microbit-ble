/**
 * Variables to store received commands
 */
// Show connection status
bluetooth.onBluetoothConnected(function () {
    basic.showIcon(IconNames.Yes)
    bluetooth.uartWriteLine("CONNECTED")
})
bluetooth.onBluetoothDisconnected(function () {
    basic.showIcon(IconNames.No)
})
// Process received commands
function handleCommand (command: string) {
    if (command == "LED_ON") {
        basic.showIcon(IconNames.Heart)
        bluetooth.uartWriteLine("LED turned ON")
    } else if (command == "LED_OFF") {
        basic.clearScreen()
        bluetooth.uartWriteLine("LED turned OFF")
    } else if (command == "TEMP") {
        temp = input.temperature()
        bluetooth.uartWriteLine("TEMP:" + temp)
    } else {
        // Echo back unknown commands
        bluetooth.uartWriteLine("ECHO:" + command)
    }
}
// Handle incoming UART data
bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    receivedCommand = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine))
    basic.showString(receivedCommand.charAt(0))
    handleCommand(receivedCommand)
})
// Send sensor data periodically
function sendSensorData () {
    dataString = "DATA:" + "temp:" + input.temperature() + "," + "light:" + input.lightLevel() + "," + "accelX:" + input.acceleration(Dimension.X) + "," + "accelY:" + input.acceleration(Dimension.Y) + "," + "accelZ:" + input.acceleration(Dimension.Z)
    bluetooth.uartWriteLine(dataString)
}
let dataString = ""
let receivedCommand = ""
let temp = 0
// Enable Bluetooth services
bluetooth.startUartService()
basic.showString("UART")
// Main loop - periodically send sensor data
basic.forever(function () {
    // Send sensor data every 10 seconds
    if (input.runningTime() % 10000 < 50) {
        sendSensorData()
    }
    // Small delay to prevent blocking
    basic.pause(50)
})
