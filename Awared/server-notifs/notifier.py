from time import sleep
import tableManager
from datetime import datetime

from exponent_server_sdk import (
    DeviceNotRegisteredError,
    PushClient,
    PushMessage,
    PushServerError,
    PushTicketError,
)
import os
import requests
from requests.exceptions import ConnectionError, HTTPError



notified_users = {}
cooldown = 10

def send_push_notification(token, message, extra=None):
    try:
        response = PushClient().publish(
            PushMessage(to=token, body=message, data=extra)
        )
    except Exception as err:
        print("An error occured when attempting to send the notification:", err)

while(True):
    df = tableManager.riskDf
    for index,row in df.iterrows():
        user = row['user']
        timediff = row['hour'] - datetime.now().hour
        if timediff <= 1 and timediff >= 0:
            if notified_users.get(user) == None:
                notified_users[user] = cooldown;
            elif notified_users[user] > 0:
                notified_users[user] = notified_users[user] - 1
            else:
                print(f"{user} with token {row['token']} is near their risk hour")
                message = f"Careful {row['user']}! It seems you usually make a lot of purchases around this time of the day. Please be responsible."
                send_push_notification(row['token'], message)
                del notified_users[user]

    sleep(1800)


