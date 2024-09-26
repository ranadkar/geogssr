import React, { useEffect, useRef, useState } from "react";
import "./Game.css";
import locations from "./world.js";

const Game = () => {
  const streetViewRef = useRef(null);
  const mapRef = useRef(null);
  const fullScreenMapRef = useRef(null);
  const panoRef = useRef(null);
  const compassRef = useRef(null);
  const [panoId, setPanoId] = useState(null);
  const [locationStr, setLocationStr] = useState(null);
  const [actualLocation, setActualLocation] = useState(null); // Store the original location
  const [guessLocation, setGuessLocation] = useState(null); // Store the guessed location
  const [guessMarker, setGuessMarker] = useState(null); // Guess marker
  const [isHovered, setIsHovered] = useState(false); // Track hover state
  const [timer, setTimer] = useState(null); // Timer for unhover effect
  const [isSubmitted, setSubmitted] = useState(false); // Track submission state
  const [hasGuessed, setHasGuessed] = useState(false); // Track if the user has guessed
  const [distance, setDistance] = useState(null); // Distance between actual and guessed location
  const [score, setScore] = useState(0); // User's score

  const displayStreetViewLocation = () => {
    const location = locations[Math.floor(Math.random() * locations.length)]; // Random location from the list
    const coords = { lat: location.lat, lng: location.lng };

    // Set the chosen random location for Street View
    setActualLocation(coords);
    setPanoId(location.panoId);

    // Initialize the Street View panorama using the panoId
    const panorama = new window.google.maps.StreetViewPanorama(
      streetViewRef.current,
      {
        pano: location.panoId,
        position: coords,
        disableDefaultUI: true,
        showRoadLabels: false,
      }
    );
    panoRef.current = panorama;

    // Initialize the map with the new location
    const mapInstance = new window.google.maps.Map(mapRef.current, {
      center: { lat: 33, lng: 20 }, // Approximate center of the world map
      zoom: 1,
      scrollwheel: true, // Scroll zoom without Ctrl
      gestureHandling: "auto", // The usual stuff
      disableDefaultUI: true,
      draggableCursor: "crosshair",
      draggingCursor: "crosshair",
    });

    // Hidden marker, shown only when the user makes a guess
    const marker = new window.google.maps.Marker({
      map: mapInstance,
    });

    setGuessMarker(marker);

    // Reverse geocoding using OpenStreetMap's Nominatim API directly
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${location.lat}&lon=${location.lng}`;

    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((data) => {
        const country = data.address?.country;
        const localDescriptor =
          data.address?.city ||
          data.address?.town ||
          data.address?.village ||
          data.address?.state ||
          data.address?.province ||
          data.address?.county;

        const locationLevels = [];
        if (localDescriptor) locationLevels.push(localDescriptor);
        if (country) locationLevels.push(country);
        const locationString = locationLevels.join(", ");
        setLocationStr(locationString);
        // console.log(locationString);
      })
      .catch((error) => {
        console.error("Geocoder failed due to:", error);
      });
  };

  // Compass
  useEffect(() => {
    if (panoRef.current) {
      panoRef.current.addListener("pov_changed", () => {
        const heading = panoRef.current.getPov().heading; // Get the current heading
        if (compassRef.current) {
          compassRef.current.style.transform = `rotate(${-heading}deg)`; // Rotate the compass element
        }
      });
    }
  }, [streetViewRef, panoRef.current]);

  useEffect(() => {
    if (locations !== null && !isSubmitted) {
      displayStreetViewLocation();
    }
    const removeUnwantedElements = () => {
      const unwantedElements = document.querySelectorAll(
        'div[style*="position: absolute; left: 0px; bottom: 0px;"]'
      );
      unwantedElements.forEach((element) => {
        element.remove();
      });
    };
    setTimeout(removeUnwantedElements, 500);
  }, [locations, isSubmitted]);

  // Stuff to do when the user makes a guess
  useEffect(() => {
    if (guessMarker && mapRef.current) {
      guessMarker.getMap().addListener("click", (event) => {
        const { latLng } = event;

        // Move the marker to the new clicked location
        guessMarker.setPosition(latLng);

        // Store the guessed location in state
        setGuessLocation(latLng);
        setHasGuessed(true); // Enable the submit button once the user has made a guess
      });
    }
  }, [guessMarker, actualLocation]);

  // Display full screen map after user has submitted their guess
  useEffect(() => {
    if (isSubmitted && fullScreenMapRef.current) {
      const bounds = new window.google.maps.LatLngBounds();
      if (actualLocation && guessLocation) {
        bounds.extend(actualLocation);
        bounds.extend(guessLocation);

        const fullScreenMap = new window.google.maps.Map(
          fullScreenMapRef.current,
          {
            center: actualLocation,
            zoom: 8,
            disableDefaultUI: true,
          }
        );

        fullScreenMap.fitBounds(bounds);

        // Marker for guessed location
        new window.google.maps.Marker({
          position: guessLocation,
          map: fullScreenMap,
        });

        // Random icon I got from google's documentation lol
        // https://developers.google.com/maps/documentation/javascript/markers
        const svgMarker = {
          path: "M-1.547 12l6.563-6.609-1.406-1.406-5.156 5.203-2.063-2.109-1.406 1.406zM0 0q2.906 0 4.945 2.039t2.039 4.945q0 1.453-0.727 3.328t-1.758 3.516-2.039 3.070-1.711 2.273l-0.75 0.797q-0.281-0.328-0.75-0.867t-1.688-2.156-2.133-3.141-1.664-3.445-0.75-3.375q0-2.906 2.039-4.945t4.945-2.039z",
          fillColor: "#0FB222", // The FB never stops
          fillOpacity: 1,
          strokeWeight: 0,
          rotation: 0,
          scale: 2,
          anchor: new google.maps.Point(0, 20),
        };

        // Marker for actual location
        new window.google.maps.Marker({
          position: actualLocation,
          map: fullScreenMap,
          icon: svgMarker,
        });

        // Fancy shmancy dotted line between the guessed and actual location
        const line = new window.google.maps.Polyline({
          path: [actualLocation, guessLocation],
          strokeColor: "#000000",
          strokeOpacity: 0,
          icons: [
            {
              icon: {
                path: "M 0,-1 0,1",
                strokeOpacity: 1,
                scale: 2,
              },
              offset: "0",
              repeat: "10px",
            },
          ],
          map: fullScreenMap,
        });

        // Calculate distance between the guess and actual location
        const calculatedDistance =
          window.google.maps.geometry.spherical.computeDistanceBetween(
            actualLocation,
            guessLocation
          );
        setDistance((calculatedDistance / 1000).toFixed(2)); // Kilometers RAHHHH

        // Goofy scoring system
        const calculatedScore = Math.round(
          5000 * Math.pow(0.999, calculatedDistance / 1000)
        );
        setScore(calculatedScore);
      }
    }
  }, [isSubmitted, actualLocation, guessLocation]);

  // Reset the game and find a new Street View location
  const handleReset = () => {
    setSubmitted(false);
    setGuessLocation(null);
    setHasGuessed(false);
    setIsHovered(false);
    setLocationStr(null);
  };

  const handleMouseEnter = () => {
    if (!isSubmitted) {
      setIsHovered(true);
      if (timer) {
        clearTimeout(timer);
      }
    }
  };

  const handleMouseLeave = () => {
    if (!isSubmitted) {
      const newTimer = setTimeout(() => {
        setIsHovered(false);
      }, 500);
      setTimer(newTimer);
    }
  };

  // Handle spacebar press to do stuff
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === "Space") {
        event.preventDefault(); // Prevent default spacebar behavior (scrolling)

        if (isSubmitted) {
          handleReset();
        } else if (hasGuessed) {
          setSubmitted(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown); // Cleanup on unmount
    };
  }, [hasGuessed, isSubmitted, setSubmitted, handleReset]);

  return (
    <div>
      {!isSubmitted && (
        <div ref={streetViewRef} className="street-view-container"></div>
      )}

      {!isSubmitted && <div ref={compassRef} className="custom-compass"></div>}

      {!isSubmitted && (
        <div
          ref={mapRef}
          className={`map-container ${isHovered ? "expanded" : ""}`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        ></div>
      )}

      {!isSubmitted && (
        <button
          onClick={() => setSubmitted(true)}
          className="submit-button"
          disabled={!hasGuessed}
        >
          Submit
        </button>
      )}

      {isSubmitted && (
        <button onClick={handleReset} className="submit-button">
          Play Again
        </button>
      )}

      {isSubmitted && (
        <div ref={fullScreenMapRef} className="full-screen-map-container"></div>
      )}

      {isSubmitted && (
        <div className="results">
          <p>Distance: {distance} km</p>
          <p>Score: {score}</p>
          <a
            href={`https://www.google.com/maps/@?api=1&map_action=pano&pano=${panoId}`}
            target="_blank"
            rel="noreferrer"
          >
            {locationStr}
          </a>
        </div>
      )}
    </div>
  );
};

export default Game;
