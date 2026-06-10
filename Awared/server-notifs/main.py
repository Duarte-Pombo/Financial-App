from flask import Flask, request, render_template
import tableManager

app = Flask(__name__)

@app.route('/savePurchase', methods=['GET', 'POST'])
def savePurchase():
    if request.method == 'POST':
        request_data = request.get_json()
        user = request_data['user']
        token = request_data['token']
        time = request_data['time']
        tableManager.updateTable(user, token, time)
    return ""

if __name__ == '__main__':
    app.run(debug=True)

