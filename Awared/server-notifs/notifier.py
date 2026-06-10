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
        timediff = row['hour'] - datetime.now().hour
        if timediff <= 1 and timediff >= 0:
            print(f"{row['user']} with token {row['token']} is near their risk hour")
            message = f"Careful {row['user']}! It seems you usually make\
            a lot of purchases near this hour. Please be responsible."
            send_push_notification(row['token'], message)

    sleep(3)


