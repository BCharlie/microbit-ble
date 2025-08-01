# micro:bit Multi-Device Controller

A Node.js application for controlling multiple BBC micro:bit devices via Bluetooth Low Energy (BLE) from a Raspberry Pi or any Linux system. This project provides both web-based and REST API interfaces for managing multiple micro:bit devices simultaneously.

## Features

- 🔗 **Multiple Device Support**: Connect and control multiple micro:bit devices simultaneously
- 🌐 **Dual Interface**: Web browser interface and REST API
- 📡 **BLE Communication**: Uses Bluetooth Low Energy for reliable, low-power communication
- 📊 **Real-time Data**: Continuous sensor data collection (temperature, light, accelerometer)
- 🔄 **Auto-Discovery**: Automatic micro:bit device discovery and connection
- 🛡️ **Robust Connection Management**: Automatic reconnection and device lifecycle handling
- 🎛️ **Remote Control**: Send commands to control LEDs, get sensor readings, and more

## Hardware Requirements

- **Host System**: Raspberry Pi (recommended) or any Linux system with Bluetooth 4.0+
- **micro:bit Devices**: One or more BBC micro:bit v1 or v2 devices
- **Bluetooth**: Built-in Bluetooth 4.0+ or USB Bluetooth adapter

## Software Requirements

- Node.js 10.0.0 or higher
- npm (Node Package Manager)
- Linux-based OS (tested on Raspberry Pi OS)

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd microbitController
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Prepare micro:bit devices**:
   - Flash the provided `microBit.js` code to your micro:bit devices
   - Ensure Bluetooth is enabled on each micro:bit

4. **Run the application**:
   ```bash
   npm start
   ```

   The server will start on port 3000 by default.

## micro:bit Setup

Flash the `microBit.js` TypeScript code to your micro:bit devices. This firmware:

- Enables Bluetooth UART service
- Responds to commands: `LED_ON`, `LED_OFF`, `TEMP`
- Sends periodic sensor data every 10 seconds
- Shows connection status on the LED matrix
- Displays command confirmations

### Supported Commands

| Command | Description | Response |
|---------|-------------|----------|
| `LED_ON` | Show heart icon | "LED turned ON" |
| `LED_OFF` | Clear display | "LED turned OFF" |
| `TEMP` | Get temperature | "TEMP:XX" (temperature in Celsius) |
| Other | Echo command | "ECHO:command" |

## Usage

### Web Interface

1. Open `http://localhost:3000` in a web browser
2. Click "Scan for micro:bit" to discover and connect devices
3. Control devices directly through the web interface

### REST API

#### Get Connected Devices
```bash
GET /api/devices
```

Response:
```json
{
  "device_id": {
    "id": "device_id",
    "customId": "device_name",
    "name": "BBC micro:bit [xxxxx]",
    "connected": true,
    "lastSeen": 1234567890,
    "data": {
      "temp": "23",
      "light": "45",
      "accelX": "0",
      "accelY": "0",
      "accelZ": "-1024"
    }
  }
}
```

#### Send Command to Device
```bash
POST /api/devices/:id/command
Content-Type: application/json

{
  "command": "LED_ON"
}
```

### Example Usage

```bash
# Get all connected devices
curl http://localhost:3000/api/devices

# Turn on LED for a specific device
curl -X POST http://localhost:3000/api/devices/DEVICE_ID/command \
  -H "Content-Type: application/json" \
  -d '{"command": "LED_ON"}'

# Get temperature reading
curl -X POST http://localhost:3000/api/devices/DEVICE_ID/command \
  -H "Content-Type: application/json" \
  -d '{"command": "TEMP"}'
```

## Project Structure

```
microbitController/
├── README.md              # This file
├── package.json          # Node.js dependencies and scripts
├── server.js            # Main Express server with BLE handling
├── index.html          # Web interface for browser-based control
├── microBit.js         # TypeScript firmware for micro:bit devices
├── public/            # Static web assets
└── .gitignore        # Git ignore patterns
```

## Configuration

### Environment Variables

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (development/production)

### Bluetooth Configuration

The application uses these UUIDs for micro:bit communication:
- **UART Service**: `6e400001-b5a3-f393-e0a9-e50e24dcca9e`
- **Write Characteristic**: `6e400003b5a3f393e0a9e50e24dcca9e`
- **Notify Characteristic**: `6e400002b5a3f393e0a9e50e24dcca9e`

## Troubleshooting

### Common Issues

1. **"No devices found"**:
   - Ensure micro:bit is powered and running the correct firmware
   - Check that Bluetooth is enabled on the host system
   - Verify the micro:bit is advertising Bluetooth services

2. **Connection fails**:
   - Reset the micro:bit device
   - Restart the Node.js application
   - Check for Bluetooth interference

3. **"Permission denied" errors**:
   - Run with sudo on Linux systems: `sudo npm start`
   - Add user to bluetooth group: `sudo usermod -a -G bluetooth $USER`

4. **Web Bluetooth not working**:
   - Use Chrome browser
   - Ensure HTTPS or localhost
   - Check browser Bluetooth permissions

### Raspberry Pi Specific

```bash
# Enable Bluetooth service
sudo systemctl enable bluetooth
sudo systemctl start bluetooth

# Check Bluetooth status
sudo systemctl status bluetooth

# Scan for devices manually
sudo hcitool lescan
```

## Development

### Running in Development Mode

```bash
npm run dev  # Uses nodemon for auto-restart
```

### Adding New Commands

1. Add command handling in `microBit.js` (micro:bit firmware)
2. Update the server's `processMessage()` function if needed
3. Add API endpoints in `server.js` for complex commands

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with actual micro:bit hardware
5. Submit a pull request

## License

ISC License - see package.json for details

## Disclaimer

**NO WARRANTY IMPLIED OR OTHERWISE. USE AT YOUR OWN RISK.**

This software is provided "as is" without warranty of any kind, express or implied. The authors are not responsible for any damage, data loss, or hardware issues that may result from using this software. Users assume all responsibility for testing and validating the software in their specific environment before deployment.

## Acknowledgments

- Built using [@abandonware/noble](https://github.com/abandonware/noble) for BLE communication
- Designed for BBC micro:bit educational computing platform
- Optimized for Raspberry Pi deployment
