// Saint Kitts Outage Map JavaScript

let map;
let outageMarkers = [];
let userReportMarkers = [];
let workingOnItMarkers = [];
let lastUpdateTime = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Saint Kitts Outage Map initializing...');
    
    // Initialize map first
    initializeMap();
    console.log('Map initialized');
    
    try {
        // Load markers from database first
        await loadDatabaseMarkers();
        console.log('Database markers loaded');
        
        // Then load any outage data
        await loadOutageData();
        console.log('Outage data loaded');
        
        // Set up buttons after data is loaded
        setupReportButton();
        setupWorkingOnItButton();
        console.log('Buttons initialized');
        
        // Auto-refresh markers and check expiration every minute
        setInterval(async () => {
            console.log('Running periodic refresh...');
            await loadDatabaseMarkers();
            await loadOutageData();
            removeExpiredMarkers();
        }, 60000);
        
        console.log('Initialization complete');
    } catch (error) {
        console.error('Error during initialization:', error);
    }
});

// Initialize Leaflet map
function initializeMap() {
    // Create map with Fort Street & Cayon Street intersection as default center
    map = L.map('map', {
        zoomControl: false,
        attributionControl: true,
        zoomSnap: 1,
        zoomDelta: 1,
        wheelPxPerZoomLevel: 60,
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true,
        scrollWheelZoom: 'center', // Force scroll wheel zoom to center
        doubleClickZoom: 'center'  // Force double-click zoom to center
    }).setView([window.mapConfig.centerLat, window.mapConfig.centerLng], window.mapConfig.zoom); // Uses Fort St & Cayon St coordinates

    // Add zoom controls to bottom left with custom options
    L.control.zoom({
        position: 'bottomleft',
        zoomInTitle: 'Zoom in',
        zoomOutTitle: 'Zoom out'
    }).addTo(map);

    // Override the scroll wheel zoom behavior to always zoom to center
    map.off('zoom');
    map.scrollWheelZoom._onWheelScroll = function(e) {
        const center = map.getCenter();
        const zoom = map.getZoom();
        const delta = L.DomEvent.getWheelDelta(e);
        const newZoom = zoom + (delta > 0 ? 1 : -1);
        
        // Always zoom to the current center, ignore mouse position
        map.setView(center, newZoom);
        L.DomEvent.stop(e);
    };

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
        minZoom: 10
    }).addTo(map);

    // Set expanded max bounds to allow more navigation freedom
    const bounds = L.latLngBounds(
        [16.5, -63.5], // Southwest coordinates (expanded)
        [18.0, -62.0]  // Northeast coordinates (expanded)
    );
    map.setMaxBounds(bounds);

    // Get user's location and center map
    getUserLocationAndCenter();

    console.log('Map initialized successfully with center-based zooming enabled');
}

// Setup report outage button
function setupReportButton() {
    const reportBtn = document.getElementById('reportOutageBtn');
    reportBtn.addEventListener('click', function() {
        requestLocation(
            async function(position) {
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;
                
                // Check if there's already a report within 40 meters
                if (canPlaceMarkerAt(userLat, userLng)) {
                    await placeUserReportMarker(userLat, userLng);
                    console.log('User report marker placed at:', userLat, userLng);
                } else {
                    alert('There is already a report within 40 meters of your location.');
                    console.log('Report blocked - existing marker within 40m radius');
                }
            },
            function(error) {
                // Error already handled by handleIOSLocationError if on iOS
                if (!isIOSDevice()) {
                    alert('Unable to get your location. Please enable location services.');
                }
                console.log('Geolocation error:', error.message);
            }
        );
    });
}

// Setup working on it button
function setupWorkingOnItButton() {
    const workingBtn = document.getElementById('workingOnItBtn');
    workingBtn.addEventListener('click', async function() {
        // Get the center of the map (crosshair location)
        const mapCenter = map.getCenter();
        const centerLat = mapCenter.lat;
        const centerLng = mapCenter.lng;
        
        // Check if we haven't exceeded the blue marker limit
        if (workingOnItMarkers.length >= 500) {
            alert('Maximum number of "Working on it" markers reached (500).');
            return;
        }
        
        // Check if there's already a blue marker within 40 meters
        if (canPlaceBlueMarkerAt(centerLat, centerLng)) {
            await placeWorkingOnItMarker(centerLat, centerLng);
            console.log('Working on it marker placed at map center:', centerLat, centerLng);
        } else {
            alert('There is already a "Working on it" marker within 40 meters of this location.');
            console.log('Blue marker blocked - existing marker within 40m radius');
        }
    });
}

// Check if a marker can be placed at the given location (40m radius check)
function canPlaceMarkerAt(lat, lng) {
    const newLocation = L.latLng(lat, lng);
    
    // Check against existing user report markers
    for (let marker of userReportMarkers) {
        const markerLocation = marker.getLatLng();
        const distance = newLocation.distanceTo(markerLocation);
        
        if (distance < 40) { // 40 meter radius
            return false;
        }
    }
    
    // Check against existing outage markers
    for (let marker of outageMarkers) {
        const markerLocation = marker.getLatLng();
        const distance = newLocation.distanceTo(markerLocation);
        
        if (distance < 40) { // 40 meter radius
            return false;
        }
    }
    
    return true;
}

// Check if a blue marker can be placed at the given location (40m radius check)
function canPlaceBlueMarkerAt(lat, lng) {
    const newLocation = L.latLng(lat, lng);
    
    // Check against existing working on it markers
    for (let marker of workingOnItMarkers) {
        const markerLocation = marker.getLatLng();
        const distance = newLocation.distanceTo(markerLocation);
        
        if (distance < 40) { // 40 meter radius
            return false;
        }
    }
    
    return true;
}

// Place a user report marker
async function placeUserReportMarker(lat, lng) {
    try {
        // Save to database first
        await saveMarkerToDatabase(lat, lng, 'outage');
        
        // Create red report marker (same style as outage markers)
        const reportIcon = L.divIcon({
            className: 'google-maps-pin',
            html: '<div class="pin-marker"></div>',
            iconSize: [23, 28],
            iconAnchor: [11, 28],
            popupAnchor: [0, -28]
        });

        // Create marker with z-index (user report markers: 1000-2999, same as outage markers)
        const zIndexValue = 1000 + userReportMarkers.length;
        const marker = L.marker([lat, lng], {
            icon: reportIcon,
            zIndexOffset: zIndexValue
        }).addTo(map);

        // Add to user report markers array
        userReportMarkers.push(marker);
        
        // Add popup with time remaining information (1 hour from now)
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
        const popupContent = createTimeRemainingPopup('outage', expiresAt.toISOString());
        marker.bindPopup(popupContent);

        // Start timer when popup opens
        marker.on('popupopen', function() {
            const popup = marker.getPopup();
            const popupElement = popup.getElement();
            if (popupElement) {
                const timerElement = popupElement.querySelector('.remaining-time');
                if (timerElement) {
                    startCountdownTimer(timerElement, expiresAt);
                }
            }
        });
        
        // Update counters to reflect new report
        updateCounters(outageMarkers);
        
        // Show success message
        const reportBtn = document.getElementById('reportOutageBtn');
        const originalText = reportBtn.innerHTML;
        reportBtn.innerHTML = '<div class="warning-icon"></div><span>Reported!</span>';
        reportBtn.style.background = '#ff6b6b'; // Lighter red instead of green
        
        // Don't revert back to original state - keep as "Reported!" permanently
    } catch (error) {
        console.error('Failed to save report marker:', error);
        alert('Failed to save report. Please try again.');
    }
}

// Add user report marker from database (used when loading existing markers)
function addUserReportMarker(lat, lng) {
    // Create red report marker (same style as outage markers)
    const reportIcon = L.divIcon({
        className: 'google-maps-pin',
        html: '<div class="pin-marker"></div>',
        iconSize: [23, 28],
        iconAnchor: [11, 28],
        popupAnchor: [0, -28]
    });

    // Create marker with z-index (user report markers: 1000-2999, same as outage markers)
    const zIndexValue = 1000 + userReportMarkers.length;
    const marker = L.marker([lat, lng], {
        icon: reportIcon,
        zIndexOffset: zIndexValue
    }).addTo(map);

    // Add to user report markers array
    userReportMarkers.push(marker);
}

// Add user report marker from database with expiration info (used when loading existing markers)
function addUserReportMarkerFromDB(lat, lng, expiresAt, createdAt) {
    // Create red report marker (same style as outage markers)
    const reportIcon = L.divIcon({
        className: 'google-maps-pin',
        html: '<div class="pin-marker"></div>',
        iconSize: [23, 28],
        iconAnchor: [11, 28],
        popupAnchor: [0, -28]
    });

    // Create marker with z-index (user report markers: 1000-2999, same as outage markers)
    const zIndexValue = 1000 + userReportMarkers.length;
    const marker = L.marker([lat, lng], {
        icon: reportIcon,
        zIndexOffset: zIndexValue
    }).addTo(map);

    // Store expiration date in marker for consistent access
    marker.expiresAt = new Date(expiresAt);
    marker.createdAt = new Date(createdAt);

    // Add popup with time remaining information
    const popupContent = createTimeRemainingPopup('outage', expiresAt);
    marker.bindPopup(popupContent);

    // Start timer when popup opens
    marker.on('popupopen', function() {
        const popup = marker.getPopup();
        const popupElement = popup.getElement();
        if (popupElement) {
            const timerElement = popupElement.querySelector('.remaining-time');
            if (timerElement) {
                startCountdownTimer(timerElement, marker.expiresAt);
            }
        }
    });

    // Add to user report markers array
    userReportMarkers.push(marker);
}

// Place a working on it marker
async function placeWorkingOnItMarker(lat, lng) {
    try {
        // Save to database first
        await saveMarkerToDatabase(lat, lng, 'working');
        
        // Create blue working marker
        const workingIcon = L.divIcon({
            className: 'google-maps-pin blue-pin',
            html: '<div class="pin-marker blue-marker"></div>',
            iconSize: [23, 28],
            iconAnchor: [11, 28],
            popupAnchor: [0, -28]
        });

        // Calculate z-index: blue markers start at 3000 (above red markers)
        const zIndexValue = 3000 + workingOnItMarkers.length;

        // Create marker with higher z-index
        const marker = L.marker([lat, lng], {
            icon: workingIcon,
            zIndexOffset: zIndexValue
        }).addTo(map);

        // Add to working on it markers array
        workingOnItMarkers.push(marker);
        
        // Add popup with time remaining information (1 hour from now)
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
        const popupContent = createTimeRemainingPopup('working', expiresAt.toISOString());
        marker.bindPopup(popupContent);

        // Start timer when popup opens
        marker.on('popupopen', function() {
            const popup = marker.getPopup();
            const popupElement = popup.getElement();
            if (popupElement) {
                const timerElement = popupElement.querySelector('.remaining-time');
                if (timerElement) {
                    startCountdownTimer(timerElement, expiresAt);
                }
            }
        });
        
        // Update the counters display
        updateCounters(outageMarkers.concat(userReportMarkers));
        
        // Show success message
        const workingBtn = document.getElementById('workingOnItBtn');
        const originalText = workingBtn.innerHTML;
        
        // Disable the button to prevent multiple clicks
        workingBtn.disabled = true;
        workingBtn.innerHTML = '<div class="info-icon"></div><span>Added!</span>';
        workingBtn.style.background = '#5bc0de'; // Lighter blue
        
        // Revert after 2 seconds and re-enable the button
        setTimeout(() => {
            workingBtn.innerHTML = originalText;
            workingBtn.style.background = '#007bff';
            workingBtn.disabled = false; // Re-enable the button
        }, 2000);
    } catch (error) {
        console.error('Failed to save working marker:', error);
        alert('Failed to save marker. Please try again.');
        
        // Re-enable button on error
        const workingBtn = document.getElementById('workingOnItBtn');
        workingBtn.disabled = false;
    }
}

// Add working on it marker from database (used when loading existing markers)
function addWorkingOnItMarkerFromDB(lat, lng, expiresAt, createdAt) {
    // Create blue working marker
    const workingIcon = L.divIcon({
        className: 'google-maps-pin blue-pin',
        html: '<div class="pin-marker blue-marker"></div>',
        iconSize: [23, 28],
        iconAnchor: [11, 28],
        popupAnchor: [0, -28]
    });

    // Calculate z-index: blue markers start at 3000 (above red markers)
    const zIndexValue = 3000 + workingOnItMarkers.length;

    // Create marker with higher z-index
    const marker = L.marker([lat, lng], {
        icon: workingIcon,
        zIndexOffset: zIndexValue
    }).addTo(map);

    // Add popup with time remaining information
    const popupContent = createTimeRemainingPopup('working', expiresAt);
    marker.bindPopup(popupContent);

    // Start timer when popup opens
    marker.on('popupopen', function() {
        const popup = marker.getPopup();
        const popupElement = popup.getElement();
        if (popupElement) {
            const timerElement = popupElement.querySelector('.remaining-time');
            if (timerElement) {
                startCountdownTimer(timerElement, new Date(expiresAt));
            }
        }
    });

    // Add to working on it markers array
    workingOnItMarkers.push(marker);
}

// Create popup content showing time remaining
function createTimeRemainingPopup(type, expiresAt) {
    // Parse dates
    const expirationDate = new Date(expiresAt);
    
    const typeText = type === 'outage' ? 'Outage Report' : 'Working On It';
    
    // Calculate initial time remaining
    const now = new Date();
    const timeRemaining = expirationDate - now;
    
    const minutes = Math.floor(timeRemaining / (1000 * 60));
    const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
    const initialTimeText = minutes > 0 ? `${minutes}m ${seconds}s remaining` : `${seconds}s remaining`;
    
    return `
        <div class="marker-popup">
            <div class="popup-header ${type}">
                <strong>${typeText}</strong>
            </div>
            <div class="popup-content">
                <div class="time-info">
                    <div class="remaining-time" data-expiration="${expiresAt}">${initialTimeText}</div>
                </div>
            </div>
        </div>
    `;
}

// Start a countdown timer for a specific element
function startCountdownTimer(element, expirationDate) {
    if (!element) return;
    
    // Ensure we have a proper Date object
    if (!(expirationDate instanceof Date)) {
        expirationDate = new Date(expirationDate);
        if (isNaN(expirationDate)) {
            console.error('Invalid expiration date:', expirationDate);
            return;
        }
    }
    
    const updateTimer = () => {
        // Check if element still exists in DOM
        if (!document.body.contains(element)) {
            return; // Stop timer if element is no longer in DOM
        }
        
        const now = new Date();
        const timeRemaining = expirationDate - now;
        
        let timeText = '';
        let statusClass = '';
        
        // Clear existing classes
        element.className = 'remaining-time';
        
        if (timeRemaining <= 0) {
            timeText = 'Expired';
            statusClass = 'expired';
        } else {
            const minutes = Math.floor(timeRemaining / (1000 * 60));
            const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
            
            if (minutes > 0) {
                timeText = `${minutes}m ${seconds}s remaining`;
            } else {
                timeText = `${seconds}s remaining`;
            }
            
            // Color based on time remaining
            if (timeRemaining < 10 * 60 * 1000) { // Less than 10 minutes
                statusClass = 'expiring-soon';
            } else if (timeRemaining < 30 * 60 * 1000) { // Less than 30 minutes
                statusClass = 'expiring-medium';
            } else {
                statusClass = 'expiring-later';
            }
        }
        
        element.textContent = timeText;
        element.classList.add(statusClass);
        
        // Continue updating if not expired and element still exists
        if (timeRemaining > 0 && document.body.contains(element)) {
            setTimeout(updateTimer, 1000);
        }
    };
    
    // Start the timer immediately
    updateTimer();
}

// Detect if user is on an iOS device
function isIOSDevice() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPad with iPadOS 13+
}

// Check if geolocation is supported and handle iOS-specific issues
function checkGeolocationSupport() {
    if (!navigator.geolocation) {
        return {
            supported: false,
            message: 'Geolocation is not supported by this browser.'
        };
    }
    
    // Check if we're on iOS and if location services might be disabled
    if (isIOSDevice()) {
        return {
            supported: true,
            isIOS: true,
            message: 'iOS device detected. Location permission may need to be granted.'
        };
    }
    
    return {
        supported: true,
        isIOS: false,
        message: 'Geolocation is supported.'
    };
}

// Enhanced geolocation request with iOS-specific handling
function requestLocation(successCallback, errorCallback, options = {}) {
    const geoSupport = checkGeolocationSupport();
    
    if (!geoSupport.supported) {
        errorCallback(new Error(geoSupport.message));
        return;
    }
    
    // Enhanced options for iOS
    const enhancedOptions = {
        enableHighAccuracy: true,
        timeout: geoSupport.isIOS ? 15000 : 10000, // Longer timeout for iOS
        maximumAge: 60000,
        ...options
    };
    
    // For iOS, we need to be more explicit about the permission request
    if (geoSupport.isIOS) {
        console.log('iOS device detected, requesting location with enhanced options...');
        
        // First, try to get the current position to trigger permission prompt
        navigator.geolocation.getCurrentPosition(
            successCallback,
            function(error) {
                console.log('iOS geolocation error:', error);
                handleIOSLocationError(error, errorCallback);
            },
            enhancedOptions
        );
    } else {
        // Standard geolocation request for non-iOS devices
        navigator.geolocation.getCurrentPosition(
            successCallback,
            errorCallback,
            enhancedOptions
        );
    }
}

// Handle iOS-specific location errors with better user guidance
function handleIOSLocationError(error, fallbackCallback) {
    let message = '';
    let instructions = '';
    
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message = 'Location access denied.';
            instructions = 'To enable location services on iOS:\n\n' +
                         '1. Go to Settings > Privacy & Security > Location Services\n' +
                         '2. Make sure Location Services is ON\n' +
                         '3. Scroll down to find your browser (Safari/Chrome)\n' +
                         '4. Select "While Using App" or "Ask Next Time"\n' +
                         '5. Refresh this page and try again';
            break;
        case error.POSITION_UNAVAILABLE:
            message = 'Location information is unavailable.';
            instructions = 'Please check that:\n' +
                         '• Location Services is enabled in iOS Settings\n' +
                         '• You have a good GPS/cellular signal\n' +
                         '• Try moving to an area with better signal';
            break;
        case error.TIMEOUT:
            message = 'Location request timed out.';
            instructions = 'This often happens on iOS. Please:\n' +
                         '• Make sure Location Services is enabled\n' +
                         '• Try refreshing the page\n' +
                         '• Check your internet connection';
            break;
        default:
            message = 'An unknown error occurred while retrieving your location.';
            instructions = 'Please try refreshing the page or check your device settings.';
    }
    
    // Show iOS-specific error dialog
    showIOSLocationDialog(message, instructions);
    
    // Still call the fallback for any additional error handling
    if (fallbackCallback) {
        fallbackCallback(error);
    }
}

// Show iOS-specific location permission dialog
function showIOSLocationDialog(message, instructions) {
    const dialog = document.createElement('div');
    dialog.className = 'ios-location-dialog';
    dialog.innerHTML = `
        <div class="ios-dialog-overlay">
            <div class="ios-dialog-content">
                <div class="ios-dialog-header">
                    <h3>📍 Location Access Required</h3>
                </div>
                <div class="ios-dialog-body">
                    <p><strong>${message}</strong></p>
                    <div class="ios-instructions">
                        <p>${instructions.replace(/\n/g, '<br>')}</p>
                    </div>
                </div>
                <div class="ios-dialog-footer">
                    <button onclick="this.closest('.ios-location-dialog').remove()" class="ios-dialog-btn">
                        Got it
                    </button>
                    <button onclick="window.location.reload()" class="ios-dialog-btn ios-primary">
                        Refresh Page
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Auto-remove after 30 seconds
    setTimeout(() => {
        if (dialog.parentNode) {
            dialog.remove();
        }
    }, 30000);
}
function getUserLocationAndCenter() {
    console.log('Requesting user location...');
    
    requestLocation(
        function(position) {
            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;
            
            console.log(`User location found: ${userLat}, ${userLng}`);
            
            // Always center on user's location regardless of bounds
            map.setView([userLat, userLng], 14); // Zoom level 14
            console.log('Map centered on user location with zoom level 14');
        },
        function(error) {
            console.log('Geolocation error:', error.message);
            console.log('Using default Saint Kitts center location');
            // Keep the default center if geolocation fails
        },
        {
            maximumAge: 300000 // 5 minutes
        }
    );
}

// Load outage data from API
async function loadOutageData() {
    showLoading(true);
    
    try {
        const response = await fetch('/api/outages');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Clear existing markers
        clearMarkers();
        
        // Add new markers
        data.outages.forEach(outage => {
            addOutageMarker(outage);
        });
        
        // Update counters
        updateCounters(data.outages);
        
        console.log(`Loaded ${data.outages.length} outages`);
        
    } catch (error) {
        console.error('Error loading outage data:', error);
        showError('Failed to load outage data. Please try again.');
    } finally {
        showLoading(false);
    }
}

// Add outage marker to map with expiration handling
function addOutageMarker(outage) {
    // Create Google Maps style red pin icon
    const googleMapsPin = L.divIcon({
        className: 'google-maps-pin',
        html: '<div class="pin-marker"></div>',
        iconSize: [23, 28],
        iconAnchor: [11, 28],
        popupAnchor: [0, -28]
    });

    // Create marker with z-index (red markers: 1000-2999)
    const zIndexValue = 1000 + outageMarkers.length;
    const marker = L.marker([outage.lat, outage.lng], {
        icon: googleMapsPin,
        zIndexOffset: zIndexValue
    }).addTo(map);

    // Add expiration data to marker
    marker.expiresAt = new Date(outage.expires_at);
    marker.createdAt = new Date(outage.created_at);

    // Add popup with countdown
    const popupContent = createTimeRemainingPopup('outage', outage.expires_at);
    marker.bindPopup(popupContent);

    // Start countdown when popup opens
    marker.on('popupopen', function() {
        const popup = marker.getPopup();
        const popupElement = popup.getElement();
        if (popupElement) {
            const timerElement = popupElement.querySelector('.remaining-time');
            if (timerElement) {
                startCountdownTimer(timerElement, marker.expiresAt);
            }
        }
    });

    outageMarkers.push(marker);
}

// Clear all markers from map
function clearMarkers() {
    outageMarkers.forEach(marker => {
        map.removeLayer(marker);
    });
    outageMarkers = [];
}

// Clear working on it markers
function clearWorkingOnItMarkers() {
    workingOnItMarkers.forEach(marker => {
        map.removeLayer(marker);
    });
    workingOnItMarkers = [];
}

// Load markers from database
async function loadDatabaseMarkers() {
    console.log('Loading database markers...');
    try {
        const response = await fetch('/api/markers');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Database markers response:', data);
        
        if (data.success) {
            // Clear all existing markers first
            console.log('Clearing existing markers...');
            clearUserMarkers();
            clearWorkingOnItMarkers();
            
            // Add markers from database
            console.log('Adding markers to map...');
            for (const marker of data.markers) {
                try {
                    const lat = marker.lat || marker.latitude;
                    const lng = marker.lng || marker.longitude;
                    
                    console.log('Processing marker:', { 
                        type: marker.type, 
                        lat, 
                        lng, 
                        expires_at: marker.expires_at,
                        created_at: marker.created_at 
                    });
                    
                    // Ensure we have valid Date objects for timestamps
                    const expiresAt = new Date(marker.expires_at);
                    const createdAt = new Date(marker.created_at);
                    
                    // Verify the dates are valid before adding markers
                    if (isNaN(expiresAt.getTime()) || isNaN(createdAt.getTime())) {
                        console.error('Invalid date for marker:', marker);
                        continue;
                    }
                    
                    // Only add non-expired markers
                    if (expiresAt > new Date()) {
                        if (marker.type === 'outage') {
                            console.log('Adding outage marker');
                            addUserReportMarkerFromDB(lat, lng, marker.expires_at, marker.created_at);
                        } else if (marker.type === 'working') {
                            console.log('Adding working marker');
                            addWorkingOnItMarkerFromDB(lat, lng, marker.expires_at, marker.created_at);
                        }
                    } else {
                        console.log('Skipping expired marker:', marker);
                    }
                } catch (error) {
                    console.error('Error processing marker:', marker, error);
                }
            }
            
            console.log(`Loaded ${data.markers.length} markers from database`);
            
            // Update counters with all markers
            const allOutageMarkers = outageMarkers.concat(userReportMarkers);
            updateCounters(allOutageMarkers);
        } else {
            console.error('Failed to load markers:', data.error);
        }
    } catch (error) {
        console.error('Error loading database markers:', error);
        throw error; // Re-throw to handle in the caller
    }
}

// Clear user-generated markers
function clearUserMarkers() {
    userReportMarkers.forEach(marker => {
        map.removeLayer(marker);
    });
    userReportMarkers = [];
}

// Save marker to database
async function saveMarkerToDatabase(latitude, longitude, type) {
    try {
        const response = await fetch('/api/markers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                latitude: latitude,
                longitude: longitude,
                type: type
            })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to save marker');
        }
        
        console.log(`${type} marker saved to database`);
        return data;
    } catch (error) {
        console.error('Error saving marker to database:', error);
        throw error;
    }
}

// Refresh outages manually
function refreshOutages() {
    const refreshIcon = document.getElementById('refresh-icon');
    refreshIcon.classList.add('spinning');
    
    loadOutageData().finally(() => {
        setTimeout(() => {
            refreshIcon.classList.remove('spinning');
        }, 1000);
    });
}

// Show/hide loading overlay
function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (show) {
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
}

// Show error message
function showError(message) {
    // Create toast or alert for error
    console.error(message);
    // You could implement a toast notification here
}

// Update counters display
function updateCounters(outages) {
    // Count total outage reports: hardcoded outages + user reports from database
    const reportsCount = outages.length + userReportMarkers.length;
    const workingOnItCount = workingOnItMarkers.length; // Use actual working on it markers count
    
    document.getElementById('reports-count').textContent = reportsCount;
    document.getElementById('confirmations-count').textContent = workingOnItCount;
}

// Remove expired markers
function removeExpiredMarkers() {
    const now = new Date();
    const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds

    function removeExpired(markers) {
        for (let i = markers.length - 1; i >= 0; i--) {
            const marker = markers[i];
            if (marker.expiresAt) {
                const expirationTime = new Date(marker.expiresAt);
                if (now >= expirationTime) {
                    map.removeLayer(marker);
                    markers.splice(i, 1);
                }
            }
        }
    }

    // Check all marker arrays
    removeExpired(outageMarkers);
    removeExpired(userReportMarkers);
    removeExpired(workingOnItMarkers);

    // Update counters after removing expired markers
    updateCounters(outageMarkers);
}

// Update and cleanup all markers
function updateAllMarkers() {
    const now = new Date();
    
    // Function to check and remove expired markers
    function checkAndRemoveExpired(markers) {
        for (let i = markers.length - 1; i >= 0; i--) {
            const marker = markers[i];
            if (marker.expiresAt && marker.expiresAt <= now) {
                map.removeLayer(marker);
                markers.splice(i, 1);
            }
        }
    }
    
    // Check all marker types
    checkAndRemoveExpired(outageMarkers);
    checkAndRemoveExpired(userReportMarkers);
    checkAndRemoveExpired(workingOnItMarkers);
    
    // Update counters
    updateCounters(outageMarkers.concat(userReportMarkers));
}

// Handle orientation change on mobile
window.addEventListener('orientationchange', function() {
    setTimeout(() => {
        map.invalidateSize();
    }, 100);
});

// Handle window resize
window.addEventListener('resize', function() {
    map.invalidateSize();
});

// Utility function to check API status
async function checkApiStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        console.log('API Status:', data);
        return data;
    } catch (error) {
        console.error('API Status Error:', error);
        return null;
    }
}
