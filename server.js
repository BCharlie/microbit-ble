// server.js - Express server for micro:bit control

const express = require('express');
const http = require('http');
const path = require('path');
const noble = require('@abandonware/noble');
const bodyParser = require('body-parser');

// Express app setup
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Micro:bit BLE UART Service UUID
const UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const WRITE_CHARACTERISTIC_UUID = '6e400003b5a3f393e0a9e50e24dcca9e'; // For writing
const NOTIFY_CHARACTERISTIC_UUID = '6e400002b5a3f393e0a9e50e24dcca9e'; // For notifications

// Store for connected micro:bits
const connectedDevices = {};
let isScanning = false;

// Enhanced logging
function log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}

// Start BLE scanning
function startScanning() {
    if (noble.state === 'poweredOn' && !isScanning) {
        log('Starting scan for micro:bit devices...');
        noble.startScanning([], true);
        isScanning = true;
    }
}

// Handle noble state changes
noble.on('stateChange', state => {
    log(`Bluetooth adapter state changed to: ${state}`);
    
    if (state === 'poweredOn') {
        startScanning();
    } else {
        log('Stopping scan - Bluetooth adapter is not powered on');
        noble.stopScanning();
        isScanning = false;
    }
});

// Handle discovered devices
noble.on('discover', peripheral => {
    log(`Device found: ${peripheral.advertisement.localName || 'Unknown'} (${peripheral.id})`);
    
    // Check if this is a micro:bit device
    if (peripheral.advertisement.localName && 
        peripheral.advertisement.localName.includes('BBC micro:bit')) {
        
        log('Found a micro:bit device! Connecting...');
        connectToMicrobit(peripheral);
    }
});

function connectToMicrobit(peripheral) {
    // Check if already connected
    if (connectedDevices[peripheral.id]) {
        log(`Already connected to micro:bit ${peripheral.id}`);
        return;
    }
    
    log(`Connecting to micro:bit ${peripheral.id}...`);
    
    // Store information about this device
    connectedDevices[peripheral.id] = {
        peripheral: peripheral,
        name: peripheral.advertisement.localName || 'Unknown micro:bit',
        id: peripheral.id,
        connected: false,
        writeChar: null,
        notifyChar: null,
        customId: null,
        lastSeen: Date.now(),
        data: {}
    };
    
    peripheral.once('connect', () => {
        log(`Connected to: ${peripheral.advertisement.localName} (${peripheral.id})`);
        connectedDevices[peripheral.id].connected = true;
        connectedDevices[peripheral.id].lastSeen = Date.now();
        
        // Continue scanning for other devices
        startScanning();
        
        // Discover services
        discoverServices(peripheral);
    });
    
    peripheral.once('disconnect', () => {
        log(`Disconnected from micro:bit ${peripheral.id}`);
        
        // Clean up device entry
        if (connectedDevices[peripheral.id]) {
            connectedDevices[peripheral.id].connected = false;
            
            // After timeout, remove from the list completely
            setTimeout(() => {
                if (connectedDevices[peripheral.id] && !connectedDevices[peripheral.id].connected) {
                    delete connectedDevices[peripheral.id];
                    log(`Removed micro:bit ${peripheral.id} from connected devices list`);
                }
            }, 60000); // 1 minute timeout
        }
    });
    
    // Connect to the peripheral
    peripheral.connect(error => {
        if (error) {
            log(`Error connecting to micro:bit ${peripheral.id}: ${error}`);
            delete connectedDevices[peripheral.id];
        }
    });
}

function discoverServices(peripheral) {
    log(`Discovering services for micro:bit ${peripheral.id}...`);
    
    peripheral.discoverServices([UART_SERVICE_UUID], (error, services) => {
        if (error) {
            log(`Error discovering services: ${error}`);
            return;
        }
        
        if (services.length === 0) {
            log('ERROR: No UART service found on the micro:bit');
            return;
        }
        
        const uartService = services[0];
        log(`Found UART service: ${uartService.uuid}`);
        
        uartService.discoverCharacteristics([], (error, characteristics) => {
            if (error) {
                log(`Error discovering characteristics: ${error}`);
                return;
            }
            
            characteristics.forEach(characteristic => {
                // Match by UUID
                if (characteristic.uuid === WRITE_CHARACTERISTIC_UUID) {
                    connectedDevices[peripheral.id].writeChar = characteristic;
                    log(`Found WRITE characteristic for micro:bit ${peripheral.id}`);
                } 
                
                if (characteristic.uuid === NOTIFY_CHARACTERISTIC_UUID) {
                    connectedDevices[peripheral.id].notifyChar = characteristic;
                    log(`Found NOTIFY characteristic for micro:bit ${peripheral.id}`);
                    
                    // Subscribe to notifications
                    subscribeToNotifications(peripheral.id, characteristic);
                }
            });
        });
    });
}

function subscribeToNotifications(deviceId, characteristic) {
    characteristic.on('data', (data, isNotification) => {
        try {
            const message = data.toString().trim();
            log(`Received from micro:bit ${deviceId}: "${message}"`);
            
            // Update last seen timestamp
            if (connectedDevices[deviceId]) {
                connectedDevices[deviceId].lastSeen = Date.now();
            }
            
            // Process the message
            processMessage(deviceId, message);
            
        } catch (e) {
            log(`Error processing received data: ${e.message}`);
        }
    });
    
    characteristic.subscribe(error => {
        if (error) {
            log(`Error subscribing to notifications: ${error}`);
        } else {
            log(`Successfully subscribed to micro:bit ${deviceId} notifications`);
        }
    });
}

function processMessage(deviceId, message) {
    const device = connectedDevices[deviceId];
    if (!device) return;
    
    // Handle CONNECTED message (with device ID)
    if (message.startsWith('CONNECTED:')) {
        const customId = message.substring(10).trim();
        device.customId = customId;
        log(`micro:bit ${deviceId} identified itself as "${customId}"`);
        return;
    }
    
    // Handle DATA message (with sensor data)
    if (message.startsWith('DATA:')) {
        const dataStr = message.substring(5).trim();
        const dataParts = dataStr.split(',');
        
        // Parse the data parts
        dataParts.forEach(part => {
            const [key, value] = part.split(':');
            if (key && value) {
                // If this is the ID, update the custom ID
                if (key.trim() === 'id') {
                    device.customId = value.trim();
                } else {
                    // Otherwise store as sensor data
                    device.data[key.trim()] = value.trim();
                }
            }
        });
        
        return;
    }
    
    // Store other messages as general responses
    device.lastResponse = message;
}

// Function to send data to a specific micro:bit
function sendToMicrobit(deviceId, message) {
    const device = connectedDevices[deviceId];
    
    if (!device || !device.connected || !device.writeChar) {
        log(`ERROR: Cannot send to micro:bit ${deviceId} - Not connected or write characteristic not found`);
        return false;
    }
    
    // Add a newline if not present
    if (!message.endsWith('\n')) {
        message += '\n';
    }
    
    log(`Sending to micro:bit ${deviceId}: "${message.trim()}"`);
    
    device.writeChar.write(Buffer.from(message), false, error => {
        if (error) {
            log(`Error sending data to micro:bit ${deviceId}: ${error}`);
        } else {
            log(`Data sent successfully to micro:bit ${deviceId}`);
        }
    });
    
    return true;
}

// Check for inactive devices periodically
setInterval(() => {
    const now = Date.now();
    
    Object.keys(connectedDevices).forEach(deviceId => {
        const device = connectedDevices[deviceId];
        
        // If device hasn't been seen in 30 seconds, consider it inactive
        if (now - device.lastSeen > 30000) {
            log(`micro:bit ${deviceId} hasn't sent data in 30 seconds`);
            
            // If it's marked as connected, try to disconnect
            if (device.connected) {
                log(`Disconnecting inactive micro:bit ${deviceId}...`);
                try {
                    device.peripheral.disconnect();
                } catch (e) {
                    log(`Error disconnecting: ${e.message}`);
                }
            }
        }
    });
}, 10000);

// API ROUTES

// Get all connected devices
app.get('/api/devices', (req, res) => {
    const devices = {};
    
    Object.keys(connectedDevices).forEach(id => {
        const device = connectedDevices[id];
        devices[id] = {
            id: id,
            customId: device.customId,
            name: device.name,
            connected: device.connected,
            lastSeen: device.lastSeen,
            data: device.data
        };
    });
    
    res.json(devices);
});

// Send a command to a device
app.post('/api/devices/:id/command', (req, res) => {
    const deviceId = req.params.id;
    const command = req.body.command;
    
    if (!command) {
        return res.status(400).json({ error: 'Command is required' });
    }
    
    if (!connectedDevices[deviceId]) {
        return res.status(404).json({ error: 'Device not found' });
    }
    
    const success = sendToMicrobit(deviceId, command);
    
    if (success) {
        res.json({ success: true, message: `Command "${command}" sent to device ${deviceId}` });
    } else {
        res.status(500).json({ success: false, error: 'Failed to send command' });
    }
});

// Start server
server.listen(PORT, () => {
    log(`Server listening on port ${PORT}`);
});

// Handle script termination
process.on('SIGINT', () => {
    log('Shutting down...');
    
    // Disconnect all peripherals
    const disconnectPromises = Object.keys(connectedDevices).map(deviceId => {
        const device = connectedDevices[deviceId];
        if (device.connected) {
            return new Promise(resolve => {
                try {
                    device.peripheral.disconnect(() => resolve());
                } catch (e) {
                    log(`Error disconnecting ${deviceId}: ${e.message}`);
                    resolve();
                }
            });
        }
        return Promise.resolve();
    });
    
    Promise.all(disconnectPromises).then(() => {
        log('All devices disconnected. Exiting.');
        process.exit();
    });
});

process.on('uncaughtException', (error) => {
    log(`UNCAUGHT EXCEPTION: ${error.message}`);
    log(error.stack);
    process.exit(1);
});
