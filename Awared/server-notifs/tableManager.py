import pandas as pd 
from datetime import datetime

def updateTable(name, token, timeStamp):
    global df

    dt = datetime.fromtimestamp(timeStamp) 
    dtString = dt.strftime("%H:%M")
    with open("data.csv", "a") as f:
        f.write(name + ',' + token + ',' + dtString + '\n')
    
    df = pd.read_csv('data.csv')
    updateRiskTime()

def updateRiskTime():
    global df
    global riskDf

    time = df['time']
    hour = []
    for t in time:
        dt = datetime.strptime(t, "%H:%M")
        hour.append(dt.hour)
    temp = df
    temp['hour'] = hour

    g = temp.groupby(["user", "token"])["hour"].agg(pd.Series.mode)
    riskDf = g.reset_index()


df = pd.read_csv('data.csv')
riskDf = None
updateRiskTime()
