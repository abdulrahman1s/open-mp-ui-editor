/* Design-time examples. The server always supplies the actual state. */
globalThis.UI_SCREEN_NAMES = {Auth:'Login & registration',Security:'Account security',Services:'Personal services',Profile:'Profile & settings',Bank:'Bank',Chat:'Chat',Dealer:'Dealership',Garage:'Garage',Properties:'My properties',Property:'Property',Radio:'Radio',RadioLibrary:'Radio library',RadioOptions:'Radio options',RadioFilters:'Radio filters',Clothing:'Wardrobe',Developer:'Developer tools',Confirmation:'Confirmation'};
globalThis.UI_PREVIEW_STATES = {
  "Auth": {
    "Register": {
      "_title": "Register",
      "_hidden_actions": [],
      "_labels": {
        "Submit": "Register"
      },
      "_variables":{"account.submit_action":"Register"}
    },
    "Working": {
      "status": [
        {
          "type": "text",
          "text": "Checking your account…",
          "color": "#A9AFADFF"
        }
      ],
      "_disabled_actions": [
        "Password",
        "Remember",
        "Submit"
      ]
    }
  },
  "Security": {
    "New password": {
      "_variables":{"account.password_action":"Enter new password","account.confirmation_action":"Confirm new password"},
      "security_hint": null,
      "new_password": [],
      "_hidden_actions": [
        "ChangePassword",
        "Remember"
      ],
      "_labels": {
        "Password": "Enter new password",
        "ConfirmPassword": "Confirm new password"
      }
    }
  },
  "Bank": {
    "Review transfer": {
      "review_amount": [
        {
          "type": "text",
          "text": "Review: $250",
          "color": "#E1E1C5FF"
        }
      ],
      "recipient": [
        {
          "type": "text",
          "text": "Recipient: Another_Player",
          "color": "#E1E1C5FF"
        }
      ],
      "_hidden_actions": []
    }
  },
  "Garage": {
    "Empty": {
      "vehicle_heading": null,
      "model": null,
      "condition": null,
      "lock": null,
      "empty": [
        {
          "type": "text",
          "text": "No vehicles. Visit a dealership and press H.",
          "color": "#A9AFADFF"
        }
      ]
    }
  },
  "Clothing": {
    "Empty": {
      "outfit_name": null,
      "outfit_details": null,
      "empty": [
        {
          "type": "text",
          "text": "No outfits here.\nTry another category.",
          "color": "#A9AFADFF"
        }
      ],
      "_hidden_actions": [
        {
          "Outfit": -1
        },
        {
          "Outfit": 1
        },
        "Equip"
      ]
    }
  },
  "Radio": {
    "Empty": {
      "stations": [
        {
          "type": "text",
          "text": "No stations here yet.\nClear filters, browse World,\nor add your own stream.",
          "color": "#A9AFADFF"
        }
      ],
      "results": [
        {
          "type": "text",
          "text": "0 results / Page 1 of 1",
          "color": "#A9AFADFF"
        }
      ],
      "_disabled_actions": [
        {
          "RadioPage": -1
        },
        {
          "RadioPage": 1
        }
      ]
    }
  },
  "Developer": {
    "Players": {
      "page_0": null,
      "page_4": [
        {
          "type": "text",
          "text": "No other spawned players online.",
          "color": "#A9AFADFF"
        },
        {
          "type": "buttons",
          "buttons": [
            {
              "label": "Next players",
              "action": {
                "Dev": 33
              },
              "enabled": false
            },
            {
              "label": "Player ID",
              "action": {
                "Dev": 21
              }
            }
          ]
        }
      ],
      "_styles": {
        "{\"DevPage\":0}": {
          "primary": false
        },
        "{\"DevPage\":4}": {
          "primary": true
        }
      }
    },
    "Vehicles": {
      "page_0": null,
      "page_1": [],
      "_styles": {
        "{\"DevPage\":0}": {
          "primary": false
        },
        "{\"DevPage\":1}": {
          "primary": true
        }
      }
    },
    "World": {
      "page_0": null,
      "page_2": [],
      "_styles": {
        "{\"DevPage\":0}": {
          "primary": false
        },
        "{\"DevPage\":2}": {
          "primary": true
        }
      }
    },
    "Coding": {
      "page_0": null,
      "page_3": [],
      "_styles": {
        "{\"DevPage\":0}": {
          "primary": false
        },
        "{\"DevPage\":3}": {
          "primary": true
        }
      }
    },
    "More coding": {
      "page_0": null,
      "page_5": [],
      "_styles": {
        "{\"DevPage\":0}": {
          "primary": false
        },
        "{\"DevPage\":3}": {
          "primary": true
        }
      }
    }
  },
  "RadioOptions": {
    "Selected station": {
      "station_options": [
        {
          "type": "text",
          "text": "Radio Los Santos",
          "color": "#D6B879FF"
        },
        {
          "type": "text",
          "text": "United States / MP3 / 128 kbps",
          "color": "#A9AFADFF"
        },
        {
          "type": "gap",
          "height": 8
        },
        {
          "type": "buttons",
          "buttons": [
            {
              "label": "Play station",
              "action": "RadioPlay",
              "primary": true
            },
            {
              "label": "Favorite",
              "action": "RadioFavorite"
            }
          ]
        }
      ]
    }
  }
};
