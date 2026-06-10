from flask import Flask, request, render_template

app = Flask(__name__)

@app.route('/savePurchase', methods=['GET', 'POST'])
def savePurchase():
    if request.method == 'POST':
        user = request.form['user']
        token = request.form['token']
        time = request.form['time']
        print(f"{user} {token} {time}")
    return ""

if __name__ == '__main__':
    app.run(debug=True)

